"""Shared news cadence and durable, cross-worker generation cooldown."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, update, or_
from sqlalchemy.exc import IntegrityError

from app.models.source import Source

NEWS_REFRESH_HOURS = 72
NEWS_REFRESH_SECONDS = NEWS_REFRESH_HOURS * 60 * 60
_SOURCE_KEY = "lumiere_editorial"


def claim_news_window(db, *, now=None, task="news"):
    """Reserve before calling the provider; failed attempts also respect the rest period.

    Uses existing source health metadata, with no schema migration or ranking input.
    A conditional update arbitrates concurrent workers and survives app restarts.
    """
    now = now or datetime.now(timezone.utc)
    now = now.astimezone(timezone.utc).replace(tzinfo=None)
    if task not in ("news", "games"):
        raise ValueError("Unsupported scheduled AI task")
    key = _SOURCE_KEY if task == "news" else "lumiere_ai_games"
    for source_key in (key, "lumiere_ai_cooldown"):
        source = db.scalar(select(Source).where(Source.key == source_key))
        if source is None:
            db.add(Source(key=source_key, name="Lumiere AI scheduling", weight=0, enabled=False))
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
    # Six hours between categories, in addition to each category's 72-hour rest.
    shared = db.execute(update(Source).where(
        Source.key == "lumiere_ai_cooldown",
        or_(Source.last_ingested_at.is_(None), Source.last_ingested_at <= now - timedelta(hours=6)),
    ).values(last_ingested_at=now).execution_options(synchronize_session=False))
    if shared.rowcount != 1:
        db.rollback()
        raise HTTPException(429, "Scheduled AI jobs are cooling down.", headers={"Retry-After": "21600"})
    result = db.execute(
        update(Source).where(
            Source.key == key,
            or_(Source.last_ingested_at.is_(None), Source.last_ingested_at <= now - timedelta(seconds=NEWS_REFRESH_SECONDS)),
        ).values(last_ingested_at=now, records_requested=Source.records_requested + 1)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 1:
        db.commit()
        return now.replace(tzinfo=timezone.utc) + timedelta(seconds=NEWS_REFRESH_SECONDS)
    db.rollback()
    source = db.scalar(select(Source).where(Source.key == key).execution_options(populate_existing=True))
    next_at = source.last_ingested_at + timedelta(seconds=NEWS_REFRESH_SECONDS)
    retry = max(1, int((next_at - now).total_seconds()))
    raise HTTPException(429, "This AI category rests for 72 hours between attempts.", headers={"Retry-After": str(retry)})
