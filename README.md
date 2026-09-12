# Lumière — The Index

A real-time film cultural index: audience sentiment & conversation signals from
Reddit, Letterboxd, News, YouTube, TikTok, Google Trends, and Wikipedia are
ingested, scored, and ranked into a live "what the world is talking about"
leaderboard — 0% critic weight.

## Stack

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | Vite + React 19 + TanStack Router/Start (SSR via Nitro), Tailwind 4   |
| Backend  | Python 3.12 + FastAPI + SQLAlchemy 2.0 + MySQL                         |
| Cache    | Redis (with automatic in-process TTL fallback when Redis is down)     |
| Jobs     | Celery (ranking refresh every 15 min)                                  |

## Layout

```
backend/                        FastAPI app (app/), migrations (alembic/), tests (tests/)
lumiere-the-index-codebase/     TanStack Start frontend (src/), tests (src/__tests__/)
scripts/                        One-command dev workflow
```

## Local development

Requirements: Python 3.12+ venv with `backend/requirements.txt` installed, a
local MySQL database, and Node (the frontend installs via `npm`/`bun`).

Copy `backend/.env.example` → `backend/.env` and fill in `MYSQL_*`, `TMDB_API_KEY`.

Run the whole stack as one unit (Ctrl-C stops everything, no orphans):

```bash
./scripts/dev.sh
```

Or individually:

```bash
./scripts/dev-api.sh    # API on http://127.0.0.1:8000 (auto-reload)
./scripts/dev-web.sh    # Web on http://127.0.0.1:8080
```

The backend binds immediately; the TMDB catalog sync runs in the background
after boot. Health endpoints:

- `GET /health` — process alive
- `GET /healthz` — serving requests
- `GET /readyz` — DB + ranking snapshot status (503 until data is ready)

## Tests

```bash
cd backend && .venv/Scripts/python -m pytest tests/ -q   # backend (66 tests)
cd lumiere-the-index-codebase && npx vitest run          # frontend (12 tests)
```

## Notes

- Redis is optional in dev: the API logs a warning and falls back to an
  in-process TTL cache when Redis is unreachable.
- The TMDB proxy retries transient upstream failures (DNS, timeouts, 429,
  5xx) with exponential backoff and returns a clean 503 instead of a bare 500.

---

## YouTube Data API v3

### Overview

Lumière uses the **YouTube Data API v3** as a backend-only data source to
strengthen three ranking signals:

| Signal component | YouTube contribution |
|---|---|
| **Current Attention (CA, 30%)** | Official trailer view count weighted by view velocity |
| **Momentum/Growth (M, 25%)** | View velocity (views/day since publish) → `view_velocity` column |
| **Audience Engagement (AE, 15%)** | Likes × 3 + comments × 5 + views ÷ 100 |

### Security

> **The YouTube API key is _never_ sent to the client.**

- Stored exclusively in the server environment as `YOUTUBE_API_KEY`.
- All API calls happen inside `app/services/youtube_service.py` on the backend.
- The `/films/{id}/attention-signals` endpoint only returns derived, aggregated
  metrics (view count, like count, comment count, velocity tier) — no raw
  YouTube JSON or API keys are ever serialised into the response.

### Configuration

Add to `backend/.env` (copy from `.env.example`):

```env
# YouTube Data API v3 (primary — official trailer signals)
YOUTUBE_API_KEY=AIza...

# Optional tuning (defaults shown)
YOUTUBE_QUOTA_DAILY_LIMIT=10000   # units/day from Google Cloud Console
YOUTUBE_CACHE_TTL_HOURS=12        # Redis / in-process cache TTL
```

The RapidAPI fallback (`RAPIDAPI_KEY` / `RAPIDAPI_YOUTUBE_HOST`) activates
automatically when `YOUTUBE_API_KEY` is absent or exhausted.

### Quota usage

| YouTube API operation | Quota cost | Lumière usage |
|---|---|---|
| `search.list` | 100 units | Once per film per cache TTL (~100 films/day with 10k budget) |
| `videos.list` | 1 unit | 1 unit per batch of up to 50 video IDs |

**Quota guard** (`app/services/youtube_service.py → QuotaGuard`):

- Tracks consumed units in Redis (`youtube:quota:YYYY-MM-DD`, 48-hour expiry).
- Falls back to an in-process counter when Redis is unavailable.
- Enforces a **92% soft ceiling** (9,200 units for the 10k default) so the
  account never hard-fails mid-day.
- When the ceiling is hit, `search_trailer()` returns `None` and the ingest
  pipeline falls through to the RapidAPI fallback or produces no signal.
- All quota counters reset at midnight UTC (ISO date key rollover).

### Fallback behaviour

```
1. YOUTUBE_API_KEY set AND quota available
   → search.list (100 units) → videos.list batch (1 unit)
   → persist to youtube_signals table
   → emit RawMention with engagement score

2. YOUTUBE_API_KEY exhausted (>= 92 % of daily limit)
   → quota guard fires → skip search.list
   → serve cached result if available (Redis / in-process, 6-12h TTL)

3. YOUTUBE_API_KEY absent / disabled
   → fall through to RapidAPI (RAPIDAPI_KEY + RAPIDAPI_YOUTUBE_HOST)
   → aggregate top-5 "review" search results

4. Both APIs unavailable
   → return None → no YouTube RawMention for this film this cycle
   → ranking engine runs with existing signals; no crash, no data loss
```

### Data flow

```
ingest/scheduler.py
  └─ ingest/pipeline.py
       └─ ingest/youtube.py → fetch_youtube_for_film()
            ├─ [primary]  services/youtube_service.py
            │    ├─ QuotaGuard.can_consume(100)
            │    ├─ search.list  ─→ score_trailer_candidate() heuristics
            │    ├─ videos.list batch (≤50 IDs per call)
            │    └─ persist → models/youtube.py::YouTubeSignal
            └─ [fallback] RapidAPI (youtube-v3-alternative)
```

### Database

Migration: `alembic/versions/0011_youtube_signals.py`  
Table: `youtube_signals`

| Column | Type | Notes |
|---|---|---|
| `film_id` | FK → films.id | CASCADE DELETE |
| `video_id` | VARCHAR(32) | YouTube video ID |
| `view_count` | BIGINT | Latest fetched count |
| `like_count` | INT | Latest fetched count |
| `comment_count` | INT | Latest fetched count |
| `view_velocity` | FLOAT | views ÷ days_since_publish |
| `confidence` | FLOAT | Matcher confidence ∈ [0, 1] |
| `is_official` | BOOL | True if matched to a known studio channel |
| `fetched_at` | DATETIME | Timestamp of last fetch (server time UTC) |

Unique constraint: `(film_id, video_id)`.

### API endpoint

```
GET /api/v1/films/{id_or_slug}/attention-signals
```

Returns processed metrics only (no raw API data):

```json
{
  "film_id": 42,
  "slug": "oppenheimer-2023",
  "title": "Oppenheimer",
  "has_youtube_signal": true,
  "data_status": "fresh",
  "last_fetched_at": "2024-11-15T10:30:00Z",
  "trailer": {
    "video_id": "uYPbbksJxIg",
    "video_title": "Oppenheimer | New Trailer",
    "channel_title": "Universal Pictures",
    "published_at": "2023-05-08T13:00:00Z",
    "is_official": true,
    "confidence": 0.95
  },
  "metrics": {
    "view_count": 14800000,
    "like_count": 198000,
    "comment_count": 12400,
    "view_velocity_daily": 3200.5,
    "engagement_rate": 1.422
  },
  "derived": {
    "formatted_views": "14.8M",
    "formatted_reactions": "198K",
    "formatted_comments": "12.4K",
    "momentum_indicator": "steady",
    "attention_tier": "viral"
  }
}
```

`data_status` values: `"fresh"` (< 6h), `"cached"` (6–24h), `"stale"` (> 24h).  
`momentum_indicator` values: `"surging"` (≥500k views/day), `"rising"` (≥100k), `"steady"` (≥10k), `"cooling"` (< 10k).  
`attention_tier` values: `"viral"` (≥10M views), `"high"` (≥2M), `"moderate"` (≥200k), `"low"` (< 200k).

### Official trailer matching

`score_trailer_candidate()` in `youtube_service.py` applies multi-factor heuristics:

- **Studio channel detection**: matches against a curated set of known studio
  channel names (Warner Bros, Universal, A24, Sony, etc.). Adds +0.35.
- **Trailer keyword scoring**: `"official trailer"` +0.25, `"main/final trailer"` +0.20,
  `"teaser trailer"` +0.15, generic `"trailer"` +0.10.
- **Release year match**: year in video title or description adds +0.10.
- **Negative markers**: `"fan made"`, `"concept trailer"`, `"reaction"`,
  `"breakdown"`, `"review"`, etc. immediately return confidence 0.1 (rejected).
- **Threshold**: `YOUTUBE_MIN_CONFIDENCE=0.6` (default). Below this, the match
  is logged as low-confidence but still used if no better candidate exists.

### Tests

```bash
cd backend && .venv/Scripts/python -m pytest tests/test_youtube_service.py -v
```

Covers: 18-film matcher accuracy, quota guard backoff, batched `videos.list`,
view velocity computation, ranking signal degradation, and endpoint schema.
