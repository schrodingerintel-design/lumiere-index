import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1 import films, trending, meta, newsletter, tmdb_proxy, admin
from app.utils.logging_config import setup_logging
from app.utils.rate_limit import SimpleRateLimiterMiddleware

setup_logging()
log = logging.getLogger(__name__)

_sync_task: asyncio.Task | None = None


def _run_tmdb_sync_sync():
    from app.db import SessionLocal
    from app.ingest.tmdb import sync_tmdb_catalog
    with SessionLocal() as db:
        sync_tmdb_catalog(db, max_films=100)


async def _run_tmdb_sync_async():
    """Run the catalog sync off the event loop; never let it crash the app."""
    try:
        log.info("startup: TMDB catalog sync started (background)...")
        await asyncio.to_thread(_run_tmdb_sync_sync)
        log.info("startup: TMDB catalog sync complete")
    except Exception as exc:
        log.warning("startup: TMDB sync failed (non-fatal) — %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bind the port immediately; run the TMDB catalog sync in the background.

    The sync is a slow, non-critical side job — it must never block the server
    from accepting requests. Serve from whatever data already exists while the
    sync refreshes the catalog, and let /readyz report when data is available.
    """
    # ── Database Bootstrapping ────────────────────────────────────────────────
    # If the database has no films or ranking snapshots, run seed immediately.
    try:
        from app.db import SessionLocal
        from sqlalchemy import select, func
        from app.models import Film, Ranking
        with SessionLocal() as db:
            film_cnt = db.scalar(select(func.count(Film.id))) or 0
            rank_cnt = db.scalar(select(func.count(Ranking.id))) or 0
            if film_cnt == 0 or rank_cnt == 0:
                log.info("startup: database empty (films=%s, rankings=%s) — auto-seeding...", film_cnt, rank_cnt)
                import seed
                seed.run()
                log.info("startup: auto-seed complete")
    except Exception as exc:
        log.warning("startup: auto-seed check failed (non-fatal) — %s", exc)

    if settings.tmdb_api_key:
        _sync_task = asyncio.create_task(_run_tmdb_sync_async())
        log.info("startup: server ready immediately; TMDB sync running in background")
    else:
        log.info("startup: TMDB_API_KEY not set — using seed data")
    yield
    if _sync_task:
        _sync_task.cancel()
        try:
            await _sync_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Lumière The Index API", version="0.1.0", lifespan=lifespan)

app.add_middleware(SimpleRateLimiterMiddleware, requests_per_minute=120)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_origin_regex=(
        r"https://lumiere-index.*\.vercel\.app"
        r"|https://lumiere-index-production\.up\.railway\.app"
        r"|http://localhost(:\d+)?"
    ),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.middleware("http")
async def add_cache_headers(request, call_next):
    """Let browsers short-circuit repeat reads of public ranking endpoints.

    Rankings refresh every 15 minutes and the endpoint cache TTL is 60s, so
    caching public GET responses for 60s is safe and skips a full round-trip
    on every client-side navigation. Admin/mutation and live TMDB proxy calls
    are intentionally excluded.
    """
    response = await call_next(request)
    path = request.url.path
    if (
        request.method == "GET"
        and response.status_code == 200
        and path.startswith("/api/v1")
        and not path.startswith("/api/v1/admin")
        and not path.startswith("/api/v1/newsletter")
        and "/tmdb/" not in path
    ):
        response.headers["Cache-Control"] = "public, max-age=60"
    return response

app.include_router(films.router, prefix="/api/v1", tags=["films"])
app.include_router(trending.router, prefix="/api/v1", tags=["trending"])
app.include_router(meta.router, prefix="/api/v1", tags=["meta"])
app.include_router(newsletter.router, prefix="/api/v1", tags=["newsletter"])
app.include_router(tmdb_proxy.router, prefix="/api/v1", tags=["tmdb-proxy"])
app.include_router(admin.router, prefix="/api/v1", tags=["admin"])


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/healthz")
def healthz():
    """Liveness: the process is up and serving requests."""
    return {"status": "ok"}


@app.get("/readyz")
def readyz(response: Response):
    """Readiness: can we serve real data? Checks DB + latest ranking snapshot.

    The background TMDB sync does NOT gate readiness — the app is ready to
    serve whatever data exists, and /readyz reports the data status explicitly
    so a load balancer / orchestrator can decide.
    """
    from sqlalchemy import select, func
    from app.db import SessionLocal
    from app.models import Ranking
    from app.utils.cache import get_redis

    db_status = "unreachable"
    snapshot_ready = False
    try:
        with SessionLocal() as db:
            snap = db.scalar(select(func.max(Ranking.snapshot_at)))
            db_status = "ok"
            snapshot_ready = snap is not None
    except Exception as exc:
        log.warning("readyz: DB check failed — %s", exc)

    redis = get_redis()
    redis_status = "ok" if redis else "unavailable (in-process cache)"

    ready = db_status == "ok" and snapshot_ready
    payload = {
        "status": "ready" if ready else "not_ready",
        "db": db_status,
        "redis": redis_status,
        "rankings_snapshot": "ok" if snapshot_ready else "missing",
    }
    if not ready:
        response.status_code = 503
    return payload
