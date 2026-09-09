"""Daily rollups powering sparkline + country pages."""
from datetime import date, datetime, timedelta
from sqlalchemy import delete, func
from sqlalchemy.orm import Session

from app.models import Mention, DailyScore, CountryScore, Source
from app.services.confidence import CATALOG_ONLY_SOURCE_KEYS


def rollup_daily(db: Session, days: int = 30) -> None:
    cutoff = date.today() - timedelta(days=days)
    db.execute(delete(DailyScore).where(DailyScore.day >= cutoff))
    db.execute(delete(CountryScore).where(CountryScore.day >= cutoff))

    # ── TMDB firewall ─────────────────────────────────────────────────────────
    # Catalog-only sources ("tmdb") are metadata, not cultural signals. Their
    # rows must never land in daily/country aggregates — those feed sparklines
    # and the weekly Index aggregation.
    catalog_source_ids = [
        sid for (sid,) in db.query(Source.id).filter(Source.key.in_(CATALOG_ONLY_SOURCE_KEYS)).all()
    ]

    mentions_q = db.query(
        Mention.film_id,
        func.date(Mention.created_at).label("day"),
        func.count(Mention.id).label("cnt"),
        func.avg(Mention.sentiment_score).label("savg"),
        func.sum(func.if_(Mention.sentiment_label == "positive", 1, 0)).label("pos"),
        func.sum(func.if_(Mention.sentiment_label == "neutral", 1, 0)).label("neu"),
        func.sum(func.if_(Mention.sentiment_label == "negative", 1, 0)).label("neg"),
    ).filter(func.date(Mention.created_at) >= cutoff)
    if catalog_source_ids:
        mentions_q = mentions_q.filter(~Mention.source_id.in_(catalog_source_ids))
    rows = mentions_q.group_by(Mention.film_id, "day").all()
    for fid, day, cnt, savg, pos, neu, neg in rows:
        p_val = float(pos or 0)
        n_val = float(neu or 0)
        neg_val = float(neg or 0)
        total = max(p_val + n_val + neg_val, 1.0)
        db.add(DailyScore(
            film_id=fid, day=day, mentions_count=int(cnt),
            weighted_score=float(cnt) * (1 + 0.25 * float(savg or 0)),
            sentiment_avg=float(savg or 0),
            pos_pct=100.0 * p_val / total,
            neu_pct=100.0 * n_val / total,
            neg_pct=100.0 * neg_val / total,
        ))

    country_q = db.query(
        Mention.film_id,
        Mention.country_code,
        func.date(Mention.created_at).label("day"),
        func.count(Mention.id).label("cnt"),
    ).filter(func.date(Mention.created_at) >= cutoff, Mention.country_code.isnot(None))
    if catalog_source_ids:
        country_q = country_q.filter(~Mention.source_id.in_(catalog_source_ids))
    country_rows = country_q.group_by(Mention.film_id, Mention.country_code, "day").all()
    for fid, cc, day, cnt in country_rows:
        db.add(CountryScore(
            film_id=fid, country_code=cc, day=day,
            mentions_count=int(cnt), score=float(cnt),
        ))
    db.commit()
