# Lumière The Index — Backend Plan (Python + MySQL)

Goal: replace the frontend's static `src/lib/films.ts` with a live backend that ingests film mentions from the web, scores them, and serves every page (Top 10/100, Rising, New Entries, Trending Topics, Countries, Film Detail) via a REST API refreshed every 15 minutes.

---

## 1. Stack

- **Language:** Python 3.11
- **API framework:** FastAPI + Uvicorn (async, auto OpenAPI docs, fast to integrate with the TanStack frontend)
- **DB:** MySQL 8 (utf8mb4). SQLAlchemy 2 ORM + Alembic migrations
- **Cache:** Redis (hot endpoints + rate limiting)
- **Task scheduling:** Celery + Redis broker (or APScheduler for a simpler start)
- **Sentiment / NLP:** VADER for a fast start; upgrade path to a HuggingFace transformer
- **HTTP scraping:** httpx + tenacity (retries) + BeautifulSoup
- **Env / config:** pydantic-settings, `.env`
- **Deploy:** Docker Compose (api, worker, beat, mysql, redis); Nginx or Caddy in front

---

## 2. Data Sources (mentions ingestion)

Pluggable "source adapters", each returning a normalized `Mention` object:

1. **Reddit** — `/r/movies`, `/r/TrueFilm`, `/r/flicks` via public JSON API
2. **News** — NewsAPI.org or GDELT (free) for editorial coverage
3. **YouTube** — Data API v3 for trailer/review view + comment counts
4. **Letterboxd** — public RSS/HTML for reviews and popularity
5. **Google Trends** — `pytrends` for search interest by country
6. **X/Twitter (optional, paid)** — only if API access is provisioned
7. **Wikipedia pageviews** — free, strong signal

Each adapter runs on its own schedule (5–60 min) and writes rows to `mentions`.

---

## 3. Database Schema (MySQL)

```text
films               id, slug, title, director, year, runtime_min,
                    country_origin, poster_url, backdrop_url, synopsis,
                    gradient_from, gradient_to, created_at

film_aliases        id, film_id, alias           -- alt titles for matching
directors           id, name, slug
genres              id, name
film_genres         film_id, genre_id

sources             id, key, name, weight        -- reddit=1.0, news=1.5, ...
mentions            id, film_id, source_id, external_id, url,
                    author, country_code, language, text,
                    sentiment_score, sentiment_label,
                    engagement, created_at, ingested_at
                    INDEX(film_id, created_at), UNIQUE(source_id, external_id)

daily_scores        film_id, day, mentions_count, weighted_score,
                    sentiment_avg, pos_pct, neu_pct, neg_pct
                    PRIMARY KEY(film_id, day)

rankings            id, snapshot_at, film_id, rank, score,
                    prev_rank, movement, peak_rank, weeks_on_chart
                    INDEX(snapshot_at, rank)

country_scores      film_id, country_code, day, score, mentions_count
trending_topics     id, topic, slug, score, delta_pct, snapshot_at
film_topics         film_id, topic_id, relevance
newsletter_subs     id, email, created_at, confirmed_at
users (optional)    id, email, password_hash, role, created_at
```

Alembic manages every change. Seed script inserts the 10 real films the frontend already lists.

---

## 4. Ranking Algorithm

Recomputed every 15 min by a Celery beat job:

```text
raw_score(film, window=48h) =
    Σ (source.weight × log1p(engagement) × time_decay(age_hours))
    × (1 + 0.25 × sentiment_avg)

time_decay(h) = 0.5 ** (h / 24)    # half-life 24h
```

Then normalize 0–100 across the active set, write a new row per film into `rankings` with `snapshot_at = now()`, compute `movement = prev_rank - rank`. Top 100 = first 100 rows of the latest snapshot.

Derived feeds:
- **Rising Now** = largest positive `movement`
- **New Entries** = films whose first `rankings` row is < 7 days old
- **Trending Topics** = TF-IDF over recent mention text, stored in `trending_topics`

---

## 5. Scheduled Jobs

| Job | Cadence | Purpose |
|-----|---------|---------|
| `ingest_reddit` | 10 min | Pull new posts/comments |
| `ingest_news` | 15 min | NewsAPI headlines |
| `ingest_youtube` | 30 min | Trailer/review stats |
| `ingest_trends` | 60 min | Google Trends per country |
| `score_sentiment` | continuous | Batch VADER over unscored mentions |
| `recompute_rankings` | 15 min | Rebuild snapshot + movement |
| `rebuild_trending_topics` | 30 min | TF-IDF pass |
| `rollup_daily_scores` | hourly | Aggregate for sparklines |
| `cleanup_old_mentions` | daily | Prune > 90 days |

---

## 6. REST API (consumed by the TanStack frontend)

Base: `/api/v1`

```text
GET  /films/top?limit=10|100
GET  /films/rising
GET  /films/new-entries
GET  /films/{slug}                 → film + latest ranking + sentiment split
GET  /films/{slug}/mentions?days=30
GET  /films/{slug}/countries       → country breakdown for detail page
GET  /films/{slug}/timeline?days=30 → sparkline data
GET  /trending/topics
GET  /countries                    → global country grid
GET  /stats/live                   → totals for hero stats grid
POST /newsletter/subscribe
GET  /meta/refresh                 → last snapshot_at + next refresh ETA (15-min countdown)
```

All list endpoints paginated (`?page`, `?limit`). Responses cached in Redis 60 s. CORS locked to the frontend domain.

---

## 7. Frontend Integration

- Replace `src/lib/films.ts` static exports with a thin `apiClient.ts` (fetch wrapper) + TanStack Query hooks.
- Loaders in each route file (`top-100.tsx`, `rising.tsx`, `films.$slug.tsx`, etc.) call `context.queryClient.ensureQueryData` against the new endpoints.
- Sidebar countdown reads `/meta/refresh` so the 15-min timer reflects real snapshots.
- Add `VITE_API_BASE_URL` to `.env`.

---

## 8. Project Layout

```text
backend/
  app/
    main.py                 # FastAPI app
    config.py               # pydantic settings
    db.py                   # engine, session
    models/                 # SQLAlchemy models
    schemas/                # Pydantic response models
    api/v1/                 # routers: films, trending, countries, meta, newsletter
    services/
      ranking.py
      sentiment.py
      matching.py           # mention → film resolver
    ingest/
      base.py
      reddit.py
      news.py
      youtube.py
      trends.py
      wikipedia.py
    workers/
      celery_app.py
      beat_schedule.py
      tasks.py
    utils/
  alembic/                  # migrations
  tests/
  Dockerfile
  docker-compose.yml
  requirements.txt
  .env.example
```

---

## 9. Delivery Phases

1. **Bootstrap** — repo, Docker Compose (mysql, redis, api), FastAPI hello, Alembic init.
2. **Schema + seed** — models, migrations, seed the 10 films from `src/lib/films.ts`.
3. **Read API on seed data** — implement all GET endpoints returning seeded/mock rankings so the frontend can switch off static data immediately.
4. **Frontend cutover** — swap `films.ts` for API calls behind `VITE_API_BASE_URL`.
5. **Ingestion adapters** — Reddit + News first (highest signal / free), write to `mentions`.
6. **Sentiment + matching** — VADER pipeline, alias-based film resolver.
7. **Ranking engine + scheduler** — Celery beat every 15 min, snapshots into `rankings`.
8. **Country + trending topics** — country_scores rollup, TF-IDF topics.
9. **Extra sources** — YouTube, Trends, Wikipedia, Letterboxd.
10. **Hardening** — auth for admin routes, rate limiting, logging (structlog), Sentry, backups, load test, deploy.

---

## 10. Open Questions Before Build

1. Which ingestion sources do you want in v1? (Reddit + News is the leanest useful set — free and no keys beyond NewsAPI.)
2. Do you have API keys for NewsAPI / YouTube, or should the plan assume free-tier signup?
3. Where will this be hosted (VPS, Fly.io, Railway, AWS)? Affects Docker vs managed MySQL choice.
4. Is an admin dashboard (add/edit films, ban sources) in scope now, or later?
