from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Ranking, Mention, Film, CountryScore, Source, PendingMention
from app.services.confidence import CATALOG_ONLY_SOURCE_KEYS
from app.schemas import RefreshMeta, LiveStats, SourceHealth, SignalHealthFilm, SignalHealthSummary

router = APIRouter()

_SOURCE_CONFIG_KEY = {
    "news": "newsapi_key",
    "youtube": "youtube_api_key",
    "tmdb": "tmdb_api_key",
    "tiktok": "rapidapi_key",
}

_KNOWN_SOURCES = {
    "reddit": "Reddit",
    "news": "News API",
    "youtube": "YouTube",
    "tiktok": "TikTok",
    "wikipedia": "Wikipedia",
    "trends": "Google Trends",
    "letterboxd": "Letterboxd",
    "tmdb": "TMDB",
}


@router.get("/meta/refresh", response_model=RefreshMeta)
def refresh_meta(db: Session = Depends(get_db)):
    snap = db.scalar(select(func.max(Ranking.snapshot_at)))
    interval = settings.refresh_interval_minutes
    base = snap or datetime.now(timezone.utc)
    next_at = base + timedelta(minutes=interval)
    return RefreshMeta(snapshot_at=snap, next_refresh_at=next_at, interval_minutes=interval)


@router.get("/meta/sources", response_model=list[SourceHealth])
def source_health(db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = db.execute(
        select(
            Source.key,
            Source.name,
            Source.enabled,
            Source.weight,
            Source.last_ingested_at,
            Source.last_error,
            Source.last_error_at,
            Source.records_requested,
            Source.records_received,
            Source.records_processed,
            Source.records_rejected,
            Source.api_errors,
            Source.rate_limit_errors,
            func.count(Mention.id),
            func.coalesce(func.sum(Mention.observations), 0),
        )
        .outerjoin(Mention, Mention.source_id == Source.id)
        .where(Mention.created_at >= since)
        .group_by(Source.id)
    ).all()

    by_key = {}
    for (
        key, name, enabled, weight, last_at, last_err, last_err_at,
        requested, received, processed, rejected, api_err, rl_err, mentions, observations,
    ) in rows:
        by_key[key] = {
            "key": key,
            "name": name,
            "enabled": enabled,
            "weight": weight,
            "last_ingested_at": last_at,
            "last_error": last_err,
            "last_error_at": last_err_at,
            "mentions_24h": int(mentions),
            "observations_24h": int(observations or 0),
            "records_requested": int(requested or 0),
            "records_received": int(received or 0),
            "records_processed": int(processed or 0),
            "records_rejected": int(rejected or 0),
            "api_errors": int(api_err or 0),
            "rate_limit_errors": int(rl_err or 0),
        }

    result = []
    for key in _KNOWN_SOURCES:
        row = by_key.get(key)
        cfg_key = _SOURCE_CONFIG_KEY.get(key)
        configured = bool(getattr(settings, cfg_key)) if cfg_key else True
        if row:
            row["key_configured"] = configured
            result.append(SourceHealth(**row))
        else:
            result.append(
                SourceHealth(
                    key=key,
                    name=_KNOWN_SOURCES[key],
                    key_configured=configured,
                )
            )
    return result


@router.get("/meta/health", response_model=SignalHealthSummary)
def signal_health_summary(db: Session = Depends(get_db)):
    """Aggregate health summary for the Data/Signal Health view.

    Shows how much real evidence the Index is operating on — film coverage,
    evidence confidence, the pending (unresolved) candidate queue, and how
    many sources are currently erroring. Missing data is reported as missing;
    it is never synthesized.
    """
    now = datetime.now(timezone.utc)
    since_30d = now - timedelta(days=30)
    snap = db.scalar(select(func.max(Ranking.snapshot_at)))

    total_films = db.scalar(select(func.count(Film.id))) or 0

    films_charted = 0
    insufficient = 0
    low = 0
    if snap:
        rows = db.execute(
            select(Ranking.film_id, Ranking.sample_size, Ranking.confidence)
            .where(Ranking.snapshot_at == snap)
        ).all()
        films_charted = len(rows)
        for _, sample, conf in rows:
            tier = conf or ("insufficient" if (sample or 0) < 5 else "low")
            if tier == "insufficient":
                insufficient += 1
            elif tier == "low":
                low += 1

    # 30-day signal totals exclude catalog-only sources ("tmdb") — their rows
    # are metadata sync artifacts, not observations of cultural attention.
    catalog_ids = [
        sid for (sid,) in db.query(Source.id).filter(Source.key.in_(CATALOG_ONLY_SOURCE_KEYS)).all()
    ]
    mentions_30d_q = select(func.count(Mention.id)).where(Mention.created_at >= since_30d)
    observations_30d_q = select(func.coalesce(func.sum(Mention.observations), 0)).where(
        Mention.created_at >= since_30d
    )
    if catalog_ids:
        mentions_30d_q = mentions_30d_q.where(~Mention.source_id.in_(catalog_ids))
        observations_30d_q = observations_30d_q.where(~Mention.source_id.in_(catalog_ids))

    total_mentions_30d = db.scalar(mentions_30d_q) or 0

    # Raw observation volume vs ingest record count. Observations come from
    # aggregate sources (YouTube views, Wikipedia pageviews, Trends units) or
    # fall back to engagement for per-item sources; records are just rows.
    total_observations_30d = db.scalar(observations_30d_q) or 0

    pending = db.scalar(
        select(func.count(PendingMention.id)).where(PendingMention.status == "pending")
    ) or 0

    sources = db.query(Source).all()
    sources_ok = 0
    sources_error = 0
    for s in sources:
        if s.last_error:
            sources_error += 1
        else:
            sources_ok += 1

    from app.ingest.scheduler import last_run_times

    return SignalHealthSummary(
        total_films_tracked=total_films,
        films_charted=films_charted,
        films_with_insufficient_evidence=insufficient,
        films_with_low_evidence=low,
        total_mentions_30d=total_mentions_30d,
        pending_unresolved=pending,
        sources_ok=sources_ok,
        sources_error=sources_error,
        snapshot_at=snap,
        total_observations_30d=total_observations_30d,
        total_records_30d=total_mentions_30d,
        scheduler_enabled=settings.enable_ingest_scheduler,
        scheduler_last_runs=last_run_times(),
    )


@router.get("/meta/health/films", response_model=list[SignalHealthFilm])
def signal_health_films(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Per-film evidence status — the films with too little signal to trust.

    Ordered weakest evidence first so the Data/Signal Health view surfaces
    exactly which titles need more observations.
    """
    snap = db.scalar(select(func.max(Ranking.snapshot_at)))
    if not snap:
        return []

    rows = (
        db.query(Film, Ranking)
        .join(Ranking, Ranking.film_id == Film.id)
        .filter(Ranking.snapshot_at == snap)
        .order_by(
            Ranking.sample_size.asc().nullsfirst(),
            Ranking.score.desc(),
        )
        .offset(0)
        .limit(limit)
        .all()
    )

    # Last seen mention timestamp per film (30d) for stale-data detection.
    # Catalog-only sources are excluded so a TMDB metadata sync never makes a
    # dormant title look recently active.
    since_30d = datetime.now(timezone.utc) - timedelta(days=30)
    catalog_ids = [
        sid for (sid,) in db.query(Source.id).filter(Source.key.in_(CATALOG_ONLY_SOURCE_KEYS)).all()
    ]
    last_seen_select = (
        select(
            Mention.film_id,
            func.max(Mention.created_at),
        )
        .where(Mention.film_id.in_([f.id for f, _ in rows]), Mention.created_at >= since_30d)
    )
    if catalog_ids:
        last_seen_select = last_seen_select.where(~Mention.source_id.in_(catalog_ids))
    last_seen_rows = db.execute(last_seen_select.group_by(Mention.film_id)).all()
    last_seen = {fid: ts for fid, ts in last_seen_rows}

    return [
        SignalHealthFilm(
            slug=f.slug,
            title=f.title,
            rank=r.rank,
            score=r.score,
            sample_size=r.sample_size or 0,
            confidence=r.confidence or "insufficient",
            weeks_on_chart=r.weeks_on_chart or 0,
            last_seen_at=last_seen.get(f.id),
        )
        for f, r in rows
    ]


@router.get("/stats/live", response_model=LiveStats)
def live_stats(db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    # Live stats count real cultural signals only — catalog-only sources
    # ("tmdb") are metadata and must never inflate the public counters.
    catalog_ids = [
        sid for (sid,) in db.query(Source.id).filter(Source.key.in_(CATALOG_ONLY_SOURCE_KEYS)).all()
    ]
    mentions_q = select(func.count(Mention.id)).where(Mention.created_at >= since)
    if catalog_ids:
        mentions_q = mentions_q.where(~Mention.source_id.in_(catalog_ids))
    total_mentions = db.scalar(mentions_q) or 0
    tracked = db.scalar(select(func.count(Film.id))) or 0
    countries = db.scalar(select(func.count(func.distinct(CountryScore.country_code)))) or 0
    snap = db.scalar(select(func.max(Ranking.snapshot_at))) or datetime.now(timezone.utc)

    return LiveStats(
        total_mentions_24h=int(total_mentions),
        tracked_films=int(tracked),
        active_countries=int(countries),
        snapshot_at=snap,
    )


@router.get("/meta/schema-status")
def schema_status(db: Session = Depends(get_db)):
    """Read-only schema ground truth for production diagnostics.

    Reports whether the columns the chart-architecture code depends on
    actually exist in the live database, which tables carry an alembic
    version, and whether the Ranking table is queryable. Exposes no data.
    """
    from sqlalchemy import inspect, text
    from app.db import engine, Base

    insp = inspect(db.bind)
    expected = {
        "rankings": ["chart_type", "composite_raw"],
        "daily_index_snapshots": ["chart_type"],
        "weekly_index_snapshots": ["chart_type"],
        "index_debuts": ["chart_type"],
    }
    tables: dict[str, dict[str, object]] = {}
    for tname, cols in expected.items():
        if not insp.has_table(tname):
            tables[tname] = {"exists": False}
            continue
        existing = {c["name"] for c in insp.get_columns(tname)}
        tables[tname] = {
            "exists": True,
            "columns": {c: (c in existing) for c in cols},
            "row_probe_ok": None,
        }
    # Probe the exact queries the failing endpoints run — the error text is
    # the diagnosis; redact nothing because only column/table names appear.
    probes: dict[str, str] = {}
    for label, stmt in (
        ("rankings_simple", text("SELECT id FROM rankings LIMIT 1")),
        ("rankings_chart", text("SELECT id, chart_type FROM rankings LIMIT 1")),
        ("weekly_chart", text("SELECT id, chart_type FROM weekly_index_snapshots LIMIT 1")),
    ):
        try:
            db.execute(stmt).first()
            probes[label] = "ok"
        except Exception as exc:
            probes[label] = f"{type(exc).__name__}: {str(exc)[:200]}"
    version_row = db.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).first()

    # Reproduce the exact ORM queries of the failing endpoints — the exception
    # text is the diagnosis. Read-only; no row data is returned.
    orm_probes: dict[str, str] = {}
    from app.models import WeeklyIndexSnapshot as _W, DailyIndexSnapshot as _D

    def _probe(label: str, fn):
        try:
            fn()
            orm_probes[label] = "ok"
        except Exception as exc:
            orm_probes[label] = f"{type(exc).__name__}: {str(exc)[:300]}"

    _probe("orm_film_join_ranking", lambda: db.query(Film, Ranking).join(Ranking, Ranking.film_id == Film.id).limit(1).all())
    _probe("orm_film_ilike", lambda: db.query(Film).filter(Film.title.ilike("%a%")).limit(1).all())
    _probe("orm_weekly_join_film", lambda: db.query(_W, Film).join(Film, _W.film_id == Film.id).limit(1).all())
    _probe("orm_daily_join_film", lambda: db.query(_D, Film).join(Film, _D.film_id == Film.id).limit(1).all())
    _probe("orm_ranking_full_row", lambda: db.query(Ranking).limit(1).all())
    _probe("orm_film_full_row", lambda: db.query(Film).limit(1).all())

    return {
        "alembic_version": version_row[0] if version_row else None,
        "tables": tables,
        "probes": probes,
        "orm_probes": orm_probes,
        "models_declared": sorted(t.name for t in Base.metadata.sorted_tables),
    }
