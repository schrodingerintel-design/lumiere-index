from app.workers.celery_app import celery
from app.config import settings
from app.db import SessionLocal
from app.ingest.reddit import fetch_reddit
from app.ingest.news import fetch_news
from app.ingest.youtube import fetch_youtube
from app.ingest.tiktok import fetch_tiktok
from app.ingest.wikipedia import fetch_wikipedia
from app.ingest.trends import fetch_trends
from app.ingest.letterboxd import fetch_letterboxd
from app.ingest.pipeline import ingest_batch, record_ingest
from app.services.ranking import recompute_rankings as _recompute
from app.services.topics import rebuild_trending_topics
from app.services.rollup import rollup_daily as _rollup
from app.models import Film


def _ingest(db, source_key: str, fetch_fn) -> int:
    """Run a fetch + ingest, recording source health even on failure."""
    try:
        raws = fetch_fn()
        return ingest_batch(db, source_key, raws)
    except Exception as exc:
        record_ingest(db, source_key, error=f"{type(exc).__name__}: {exc}")
        raise


def _film_tuples(db):
    films = db.query(Film.id, Film.title, Film.year).all()
    return [(f.id, f.title, f.year) for f in films]


@celery.task
def ingest_reddit() -> int:
    with SessionLocal() as db:
        return _ingest(db, "reddit", fetch_reddit)


@celery.task
def ingest_news() -> int:
    with SessionLocal() as db:
        return _ingest(db, "news", fetch_news)


@celery.task
def ingest_youtube() -> int:
    with SessionLocal() as db:
        return _ingest(db, "youtube", lambda: fetch_youtube(_film_tuples(db)))


@celery.task
def ingest_tiktok() -> int:
    with SessionLocal() as db:
        return _ingest(db, "tiktok", lambda: fetch_tiktok(_film_tuples(db)))


@celery.task
def ingest_wikipedia() -> int:
    with SessionLocal() as db:
        return _ingest(db, "wikipedia", lambda: fetch_wikipedia(_film_tuples(db)))


@celery.task
def ingest_trends() -> int:
    with SessionLocal() as db:
        return _ingest(db, "trends", lambda: fetch_trends(_film_tuples(db)))


@celery.task
def ingest_letterboxd() -> int:
    with SessionLocal() as db:
        return _ingest(db, "letterboxd", lambda: fetch_letterboxd(_film_tuples(db)))


@celery.task
def ingest_tmdb_catalog(max_films: int = 200) -> int:
    """Scheduled catalog sync — keeps the index discovering new films."""
    from app.ingest.tmdb import sync_tmdb_catalog

    with SessionLocal() as db:
        films = sync_tmdb_catalog(db, max_films=max_films)
        return len(films)


@celery.task
def discover_candidates() -> int:
    """Resolve unmatched mentions into new films via TMDB search."""
    from app.ingest.discovery import discover_candidates as _discover

    with SessionLocal() as db:
        return _discover(
            db,
            limit=settings.discovery_batch_size,
            tmdb_limit=settings.tmdb_search_per_run,
        )


@celery.task
def recompute_rankings() -> str:
    with SessionLocal() as db:
        snap = _recompute(db)
        return snap.isoformat()


@celery.task
def rebuild_trending() -> None:
    with SessionLocal() as db:
        rebuild_trending_topics(db)


@celery.task
def rollup_daily() -> None:
    with SessionLocal() as db:
        _rollup(db)
