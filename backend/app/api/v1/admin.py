"""Admin endpoints for on-demand ingest triggers.

Protected by X-Admin-Key header matched against settings.admin_key.
Use these to bootstrap live data without waiting for the Celery beat schedule.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.ingest.pipeline import ingest_batch, record_ingest
from app.ingest.reddit import fetch_reddit
from app.ingest.news import fetch_news

router = APIRouter()


def _require_admin(x_admin_key: str = Header(default="")):
    """Reject requests with a missing or wrong admin key."""
    if not settings.admin_key or x_admin_key != settings.admin_key:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Admin-Key header")


@router.post("/admin/sync/tmdb", dependencies=[Depends(_require_admin)])
def sync_tmdb(max_films: int = 100, db: Session = Depends(get_db)):
    """Trigger a live TMDB catalog sync — fetches trending/popular/upcoming films."""
    from app.ingest.tmdb import sync_tmdb_catalog
    films = sync_tmdb_catalog(db, max_films=max_films)
    return {"ok": True, "synced_films": len(films), "source": "tmdb"}


@router.post("/admin/sync/reddit", dependencies=[Depends(_require_admin)])
def sync_reddit(db: Session = Depends(get_db)):
    """Trigger a live Reddit ingest from r/movies, r/TrueFilm, r/flicks."""
    try:
        raws = fetch_reddit()
        inserted = ingest_batch(db, "reddit", raws)
        return {"ok": True, "fetched": len(raws), "inserted": inserted, "source": "reddit"}
    except Exception as exc:
        record_ingest(db, "reddit", error=str(exc))
        raise HTTPException(status_code=502, detail=f"Reddit ingest failed: {exc}")


@router.post("/admin/sync/news", dependencies=[Depends(_require_admin)])
def sync_news(db: Session = Depends(get_db)):
    """Trigger a live news ingest."""
    try:
        raws = fetch_news()
        inserted = ingest_batch(db, "news", raws)
        return {"ok": True, "fetched": len(raws), "inserted": inserted, "source": "news"}
    except Exception as exc:
        record_ingest(db, "news", error=str(exc))
        raise HTTPException(status_code=502, detail=f"News ingest failed: {exc}")


@router.post("/admin/sync/all", dependencies=[Depends(_require_admin)])
def sync_all(db: Session = Depends(get_db)):
    """Trigger a full pipeline sync: TMDB catalog + Reddit + News."""
    from app.ingest.tmdb import sync_tmdb_catalog
    results = {}

    # 1. TMDB catalog (creates/updates films + initial mentions)
    try:
        films = sync_tmdb_catalog(db, max_films=100)
        results["tmdb"] = {"ok": True, "synced_films": len(films)}
    except Exception as exc:
        results["tmdb"] = {"ok": False, "error": str(exc)}

    # 2. Reddit mentions
    try:
        raws = fetch_reddit()
        inserted = ingest_batch(db, "reddit", raws)
        results["reddit"] = {"ok": True, "fetched": len(raws), "inserted": inserted}
    except Exception as exc:
        record_ingest(db, "reddit", error=str(exc))
        results["reddit"] = {"ok": False, "error": str(exc)}

    # 3. News mentions
    try:
        raws = fetch_news()
        inserted = ingest_batch(db, "news", raws)
        results["news"] = {"ok": True, "fetched": len(raws), "inserted": inserted}
    except Exception as exc:
        record_ingest(db, "news", error=str(exc))
        results["news"] = {"ok": False, "error": str(exc)}

    return {"ok": True, "results": results}
