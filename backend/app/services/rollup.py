"""Daily rollups powering sparkline + country pages."""
from datetime import date, datetime, timedelta
from sqlalchemy import delete, func
from sqlalchemy.orm import Session

from app.models import Mention, DailyScore, CountryScore


def rollup_daily(db: Session, days: int = 30) -> None:
    cutoff = date.today() - timedelta(days=days)
    db.execute(delete(DailyScore).where(DailyScore.day >= cutoff))
    db.execute(delete(CountryScore).where(CountryScore.day >= cutoff))

    rows = (
        db.query(
            Mention.film_id,
            func.date(Mention.created_at).label("day"),
            func.count(Mention.id).label("cnt"),
            func.avg(Mention.sentiment_score).label("savg"),
            func.sum(func.if_(Mention.sentiment_label == "positive", 1, 0)).label("pos"),
            func.sum(func.if_(Mention.sentiment_label == "neutral", 1, 0)).label("neu"),
            func.sum(func.if_(Mention.sentiment_label == "negative", 1, 0)).label("neg"),
        )
        .filter(func.date(Mention.created_at) >= cutoff)
        .group_by(Mention.film_id, "day")
        .all()
    )
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

    country_rows = (
        db.query(
            Mention.film_id,
            Mention.country_code,
            func.date(Mention.created_at).label("day"),
            func.count(Mention.id).label("cnt"),
        )
        .filter(func.date(Mention.created_at) >= cutoff, Mention.country_code.isnot(None))
        .group_by(Mention.film_id, Mention.country_code, "day")
        .all()
    )
    for fid, cc, day, cnt in country_rows:
        db.add(CountryScore(
            film_id=fid, country_code=cc, day=day,
            mentions_count=int(cnt), score=float(cnt),
        ))
    db.commit()
