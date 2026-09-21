"""Admin endpoints for on-demand ingest triggers + the score inspector.

Protected by X-Admin-Key header matched against settings.admin_key.
Use these to bootstrap live data without waiting for the Celery beat schedule.

The score inspector (GET /admin/score/{slug}) is the §25 anomaly view: for one
entity it exposes the full scoring pipeline — raw inputs, normalized
components, raw cultural momentum, final Index Score, eligibility, internal
candidate position and published chart rank — so scoring anomalies can be
identified BEFORE publication.  It is never publicly accessible and the
composite_raw values it surfaces must never appear in public responses.
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
def sync_tmdb(max_films: int = 400, content_type: str = "MOVIE", db: Session = Depends(get_db)):
    """Trigger a live TMDB catalog sync.

    ``content_type`` selects MOVIE (default) or TV_SHOW — one parameterized
    sync handles both content types."""
    from app.ingest.tmdb import sync_tmdb_catalog
    films = sync_tmdb_catalog(db, max_films=max_films, content_type=content_type)
    return {"ok": True, "synced_films": len(films), "source": "tmdb", "content_type": content_type}


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

    # 1. TMDB catalog (creates/updates content rows — catalog only, no signals)
    try:
        films = sync_tmdb_catalog(db, max_films=400)
        films += sync_tmdb_catalog(db, max_films=150, content_type="TV_SHOW")
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


# ── §25 — admin-only score inspector ────────────────────────────────────────

@router.get("/admin/score/{slug}", dependencies=[Depends(_require_admin)])
def score_inspector(slug: str, db: Session = Depends(get_db)):
    """The full scoring pipeline for one entity — ADMIN ONLY.

    Shows, in pipeline order: raw inputs (mention evidence), normalized
    component scores, the raw cultural momentum (composite) BEFORE the 0–100
    mapping, the final Index Score, eligibility state, the internal candidate
    position, and the published chart rank per chart.  Missing/fallback data
    is flagged rather than papered over.  Use it to diagnose repeated-score
    anomalies, stale defaults, or provider contamination before publication.
    """
    from datetime import date as _date

    from sqlalchemy import func as _func, select as _select

    from app.models import DailyScore, Film, Ranking

    film = db.scalar(_select(Film).where(Film.slug == slug))
    if not film:
        raise HTTPException(404, "Film not found")

    snap = db.scalar(_select(_func.max(Ranking.snapshot_at)))
    rows = (
        db.query(Ranking)
        .filter(Ranking.film_id == film.id, Ranking.snapshot_at == snap)
        .all()
        if snap else []
    )

    # 30-day raw evidence (catalog-only sources excluded upstream by design;
    # shown here as the availability picture).
    from app.models import Mention
    evidence_days = db.query(_func.count(_func.distinct(_func.date(Mention.created_at)))).filter(
        Mention.film_id == film.id
    ).scalar() or 0
    evidence_records = db.query(_func.count(Mention.id)).filter(
        Mention.film_id == film.id
    ).scalar() or 0
    observations = db.query(_func.sum(Mention.observations)).filter(
        Mention.film_id == film.id
    ).scalar() or 0

    daily_rows = (
        db.query(DailyScore)
        .filter(DailyScore.film_id == film.id)
        .order_by(DailyScore.day.desc())
        .limit(30)
        .all()
    )

    charts = []
    for r in sorted(rows, key=lambda x: x.chart_type):
        # Internal candidate position: rank within the full continuous pool
        # of this chart/snapshot — may exceed 100 and is NEVER public.
        candidate_pos = db.scalar(
            _select(_func.count(Ranking.id)).where(
                Ranking.snapshot_at == snap,
                Ranking.chart_type == r.chart_type,
                Ranking.score > r.score,
            )
        )
        charts.append({
            "chart_type": r.chart_type,
            "published_rank": r.rank if 1 <= r.rank <= 100 else None,
            "internal_candidate_position": (candidate_pos or 0) + 1,
            "index_score": r.score,
            "raw_composite": r.composite_raw,
            "attention_raw": r.attention_raw,
            "normalized_components": {
                "current_attention": r.ca_score,
                "momentum": r.momentum_score,
                "recency_of_activity": r.recency_score,
                "audience_engagement": r.ae_score,
                "cross_platform": r.cp_score,
            },
            "signal_volume": r.sample_size,
            "confidence": r.confidence,
            "peak_rank": r.peak_rank,
            "previous_rank": r.prev_rank,
            "movement": r.movement,
        })

    return {
        "entity": {
            "id": film.id,
            "slug": film.slug,
            "title": film.title,
            "content_type": film.content_type or "MOVIE",
        },
        "snapshot_at": snap,
        "eligibility": {
            "has_signal_evidence": evidence_records > 0,
            "active_days_30d": evidence_days,
            "mention_records_30d": evidence_records,
            "raw_observations_30d": int(observations or 0),
            "last_daily_rollup": daily_rows[0].day if daily_rows else None,
            "daily_scores_tracked_30d": len(daily_rows),
        },
        "charts": charts,
        "notes": [
            "attention_raw is the absolute attention intensity (decayed "
            "mentions/day, YouTube-folded); the Index Score maps it via "
            "100·log10(1+A)/log10(1+A_ref), clamped to 100 — never via rank "
            "or a pool anchor.",
            "composite_raw is the pre-scale cultural momentum used for "
            "chart ordering; the displayed score is the absolute map above.",
            "A rank beyond 100 is an internal candidate position and must never "
            "be published; the continuous table only persists the Top 100.",
            "identical scores across many titles usually indicate a normalization "
            "degeneration — check normalized_components for saturation at 0 or 1.",
        ],
        "inspected_at": datetime_now_utc(),
    }


@router.get("/admin/maintenance/preview", dependencies=[Depends(_require_admin)])
def maintenance_preview(db: Session = Depends(get_db)):
    """What the retention pass would reclaim (no writes)."""
    from app.services.retention import retention_preview

    return retention_preview(db)


@router.post("/admin/maintenance/run", dependencies=[Depends(_require_admin)])
def maintenance_run(db: Session = Depends(get_db)):
    """Run the data-retention pass now: collapse stale ranking snapshots and
    prune aged raw signals. Safe against live traffic (chunked deletes);
    published chart numbers are preserved bit-exactly."""
    from app.services.retention import run_retention

    try:
        return {"ok": True, **run_retention(db)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Retention failed: {exc}")


def datetime_now_utc():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)
