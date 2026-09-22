import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.api.v1 import films, trending, meta, newsletter, tmdb_proxy, admin, genres, index
from app.utils.logging_config import setup_logging
from app.utils.rate_limit import SimpleRateLimiterMiddleware

setup_logging()
log = logging.getLogger(__name__)

_sync_task: asyncio.Task | None = None
_scheduler_task: asyncio.Task | None = None


def _run_tmdb_sync_sync():
    from app.db import SessionLocal
    from app.ingest.tmdb import sync_tmdb_catalog
    with SessionLocal() as db:
        sync_tmdb_catalog(db, max_films=800)
        # TV shows are first-class content — same sync, same boot path.
        sync_tmdb_catalog(db, max_films=200, content_type="TV_SHOW")


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
    # Schema convergence BEFORE anything queries the DB: if the image was
    # redeployed without migrations having run against the live database,
    # queries would 5xx on missing columns and the site would read "unable
    # to load". Alembic upgrade + defensive column backfill, both best-effort.
    try:
        from app.db import engine
        from app.startup_schema import converge

        converge(engine)
    except Exception as exc:
        log.warning("startup: schema convergence failed (non-fatal) — %s", exc)

    # One-shot data healing at boot (idempotent, best-effort): normalizes any
    # legacy Trends weekly-total observation rows to the daily-interest unit
    # so the attention scale is correct immediately after this deploy instead
    # of waiting for the nightly retention pass.
    try:
        from app.db import SessionLocal
        from app.services.retention import normalize_trends_observation_units
        with SessionLocal() as db:
            fixed = normalize_trends_observation_units(db)
            log.info("startup: trends observation unit normalizer — %s", fixed)
    except Exception as exc:
        log.warning("startup: trends unit normalizer failed (non-fatal) — %s", exc)

    # One-shot catalog identity repair at boot (idempotent, best-effort):
    # links known incident titles to their true TMDB id via title + YEAR,
    # so film pages never present another film's metadata.
    try:
        from app.db import SessionLocal
        from app.services.correction import repair_known_incidents
        with SessionLocal() as db:
            reports = repair_known_incidents(db)
            if reports:
                log.info("startup: catalog identity repair — %s", reports)
    except Exception as exc:
        log.warning("startup: catalog identity repair failed (non-fatal) — %s", exc)

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

    global _sync_task, _scheduler_task
    _sync_task = None
    if settings.tmdb_api_key:
        _sync_task = asyncio.create_task(_run_tmdb_sync_async())
        log.info("startup: server ready immediately; TMDB sync running in background")
    else:
        log.info("startup: TMDB_API_KEY not set — using seed data")

    # In-process ingest scheduler: the Celery worker/beat are separate
    # processes that are not part of the API deployment, which left Reddit /
    # Wikipedia / Trends / Letterboxd never collecting in production. This
    # gives the API process its own collection cadence so signal data is real.
    if settings.enable_ingest_scheduler:
        from app.ingest.scheduler import start as start_scheduler
        _scheduler_task = start_scheduler()
    yield
    if _sync_task:
        _sync_task.cancel()
        try:
            await _sync_task
        except asyncio.CancelledError:
            pass
    if _scheduler_task:
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Lumière The Index API", version="0.1.0", lifespan=lifespan)

# Last unhandled server exception, for /meta/schema-status diagnostics.
# Production containers log to stdout we cannot read from the outside; this
# makes the real traceback observable without shell access.
LAST_SERVER_ERROR: dict = {}


@app.middleware("http")
async def capture_server_errors(request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        import traceback as _tb
        LAST_SERVER_ERROR.clear()
        LAST_SERVER_ERROR.update({
            "path": str(request.url.path),
            "type": type(exc).__name__,
            "detail": str(exc)[:500],
            "trace": _tb.format_exc()[-2000:],
        })
        raise

# ── DB outage fast-fail ──────────────────────────────────────────────────
# While the breaker (app/services/db_health.py) is open, answer 503
# immediately instead of walking the 5s TCP timeout ladder per request.
# Reads still tell the truth about why; the frontend's ChartsUnavailable
# state renders the honest message with a Retry button.
@app.middleware("http")
async def db_outage_fast_fail(request, call_next):
    from app.services import db_health

    path = request.url.path
    # Never block health probes: /healthz is Railway's liveness check — a 503
    # there would get the (healthy) API container restarted. /readyz does its
    # own DB check and reports the detail itself.
    if path in ("/health", "/healthz", "/readyz") or path.startswith("/api/v1/admin"):
        return await call_next(request)

    if db_health.is_open():
        return JSONResponse(
            status_code=503,
            headers={"Retry-After": "30"},
            content={"detail": "Database temporarily unavailable — retrying in the background"},
        )
    return await call_next(request)


app.add_middleware(SimpleRateLimiterMiddleware, requests_per_minute=120)

app.add_middleware(
    CORSMiddleware,
    # Public read-only API: "*" reflects any origin (no credentials are ever
    # sent, so the wildcard is safe and lets any frontend host integrate).
    allow_origins=settings.cors_list if "*" not in settings.cors_list else ["*"],
    allow_origin_regex=(
        r"https://lumiere-index.*\.vercel\.app"
        r"|https://lumiere-index-production\.up\.railway\.app"
        r"|https://(www\.)?lumiereindex\.com"   # canonical production frontend
        r"|http://localhost(:\d+)?"
        r"|https://.*"   # any https frontend host — the API is public and keyless
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
app.include_router(index.router, prefix="/api/v1", tags=["index"])
app.include_router(trending.router, prefix="/api/v1", tags=["trending"])
app.include_router(meta.router, prefix="/api/v1", tags=["meta"])
app.include_router(newsletter.router, prefix="/api/v1", tags=["newsletter"])
app.include_router(tmdb_proxy.router, prefix="/api/v1", tags=["tmdb-proxy"])
app.include_router(admin.router, prefix="/api/v1", tags=["admin"])
app.include_router(genres.router, prefix="/api/v1", tags=["genres"])


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
    from app.services import db_health
    from app.utils.cache import get_redis

    from app.utils.logging_config import log_throttled

    db_status = "unreachable"
    snapshot_ready = False
    try:
        with SessionLocal() as db:
            snap = db.scalar(select(func.max(Ranking.snapshot_at)))
            db_status = "ok"
            snapshot_ready = snap is not None
            db_health.record_success()
    except Exception as exc:
        db_health.record_failure(f"readyz: {type(exc).__name__}")
        # Health probes hit this every few seconds — one line a minute,
        # not 500/sec (Railway dropped 1,722 messages during the outage).
        log_throttled(
            "readyz-db", log, logging.WARNING,
            "readyz: DB check failed — %s", exc, every=60.0,
        )

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
