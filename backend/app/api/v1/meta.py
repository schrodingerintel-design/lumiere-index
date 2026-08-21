from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Ranking, Mention, Film, CountryScore, Source
from app.schemas import RefreshMeta, LiveStats, SourceHealth

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
            func.count(Mention.id),
        )
        .outerjoin(Mention, Mention.source_id == Source.id)
        .where(Mention.created_at >= since)
        .group_by(Source.id)
    ).all()

    by_key = {}
    for key, name, enabled, weight, last_at, last_err, last_err_at, mentions in rows:
        by_key[key] = {
            "key": key,
            "name": name,
            "enabled": enabled,
            "weight": weight,
            "last_ingested_at": last_at,
            "last_error": last_err,
            "last_error_at": last_err_at,
            "mentions_24h": int(mentions),
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


@router.get("/stats/live", response_model=LiveStats)
def live_stats(db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    total_mentions = db.scalar(select(func.count(Mention.id)).where(Mention.created_at >= since)) or 0
    tracked = db.scalar(select(func.count(Film.id))) or 0
    countries = db.scalar(select(func.count(func.distinct(CountryScore.country_code)))) or 0
    snap = db.scalar(select(func.max(Ranking.snapshot_at))) or datetime.now(timezone.utc)

    return LiveStats(
        total_mentions_24h=int(total_mentions),
        tracked_films=int(tracked),
        active_countries=int(countries),
        snapshot_at=snap,
    )
