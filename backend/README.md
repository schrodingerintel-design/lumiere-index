# Lumière The Index — Backend

FastAPI + MySQL + Redis + Celery service that powers the Lumière frontend.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- API: http://localhost:8000 (docs at `/docs`)
- MySQL: localhost:3306 (user `lumiere` / pw `lumiere_pw`)
- Redis: localhost:6379

The `api` container automatically runs Alembic migrations and the seed script
on boot, so the API is populated with the 10 real films and an initial
ranking snapshot on the first run.

## Local (without Docker)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export $(grep -v '^#' .env.example | xargs)   # or edit .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Run the worker + beat separately:

```bash
celery -A app.workers.celery_app.celery worker --loglevel=info
celery -A app.workers.celery_app.celery beat --loglevel=info
```

## Endpoints

Base: `/api/v1`

| Method | Path                         | Purpose                     |
| ------ | ---------------------------- | --------------------------- |
| GET    | `/films/top?limit=10`        | Top 10 / Top 100 (all films) |
| GET    | `/films/new-releases?limit=100` | New releases by score   |
| GET    | `/films/rising`              | Biggest movement            |
| GET    | `/films/new-entries`         | First charted < 7 days      |
| GET    | `/films/{slug}`              | Detail + sentiment split    |
| GET    | `/films/{slug}/timeline`     | Daily sparkline points      |
| GET    | `/films/{slug}/countries`    | Country breakdown           |
| GET    | `/stats/live`                | Hero live stats             |
| GET    | `/meta/refresh`              | Snapshot + 15-min countdown |
| POST   | `/newsletter/subscribe`      | `{ "email": "…" }`          |

## Ranking (every 15 min)

```
raw = Σ source_weight × log1p(engagement) × (0.5 ** (age_h / 24))
final = raw × (1 + 0.25 × sentiment_avg)  → normalized 0..100
```

Snapshots stored in `rankings`; `movement = prev_rank - rank`.

## Add a new source

1. Create `app/ingest/mysource.py` returning `list[RawMention]`.
2. Register a Celery task in `app/workers/tasks.py` that calls `ingest_batch(db, "mysource", fetch_mysource())`.
3. Add a schedule entry to `beat_schedule` in `celery_app.py`.
4. Insert a row in the `sources` table (or extend `SOURCES` in `app/seed.py`).

## Frontend integration

Point the TanStack app at `VITE_API_BASE_URL=http://localhost:8000/api/v1`
and replace `src/lib/films.ts` static data with fetch calls to the endpoints
above. Loaders should use `context.queryClient.ensureQueryData`.

## YouTube Data API v3 Integration

The YouTube Data API v3 ingests official trailer engagement signals to strengthen **Current Attention (30%)**, **Momentum/Growth (25%)**, and **Audience Engagement (15%)**.

### Architecture & Security
- **Strictly server-side**: `YOUTUBE_API_KEY` is kept in backend environment variables and is never exposed to client bundles or network responses.
- **Internal API**: The frontend consumes processed and derived metrics via `GET /api/v1/films/{id_or_slug}/attention-signals` (e.g. formatted views like `"14.2M"`, reaction volumes, velocity, and momentum indicators) — never raw YouTube JSON payloads.

### Quota Management & Caching
- **Quota Guard**: YouTube's default quota is 10,000 units/day (`search.list` = 100 units, `videos.list` = 1 unit). The in-process & Redis `QuotaGuard` tracks consumption. If quota usage reaches the 92% safe ceiling, expensive searches are paused and cached data is served.
- **Batching**: Calls to `videos.list` are batched up to 50 video IDs per call, costing only 1 unit per batch.
- **Caching**: Results are cached in Redis (with in-memory fallback) with a 6–12 hour TTL to prevent redundant calls during frequent ranking refreshes.

### Official Trailer Matcher
The matcher queries official studio channels (e.g. Warner Bros, Universal, Sony, Disney, Marvel, A24, Netflix, Neon, Paramount) and parses video titles to verify official trailers while filtering out fan edits, parodies, reactions, and concept trailers. Matches are scored with a confidence metric; low-confidence matches are flagged for editorial review.

### Scoring Integration & Graceful Degradation
- **Current Attention (CA)**: Blends log-transformed view velocity (`views / days_since_published`) with conversation volume.
- **Momentum/Growth (M)**: Incorporates YouTube view velocity acceleration.
- **Audience Engagement (AE)**: Factored through high-intent reactions (likes and comments density per view).
- **Graceful Fallback**: If a film lacks YouTube signals (no trailer found, API quota exhausted, or network error), the scoring engine automatically degrades to 100% pre-YouTube signal weighting without penalty, zeroing out, or errors.
