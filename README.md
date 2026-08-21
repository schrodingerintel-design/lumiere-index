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
