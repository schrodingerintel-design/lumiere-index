"""Ranking engine: consumes mentions and writes a new Ranking snapshot."""
from __future__ import annotations
import math
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Mention, Source, Film, Ranking


def _time_decay(age_hours: float, half_life: float) -> float:
    return 0.5 ** (age_hours / half_life)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def recompute_rankings(db: Session) -> datetime:
    now = datetime.now(timezone.utc)
    half_life = settings.ranking_half_life_hours

    source_weights = {s.id: s.weight for s in db.query(Source).all()}

    raw: dict[int, float] = defaultdict(float)
    sentiment_sum: dict[int, float] = defaultdict(float)
    sentiment_n: dict[int, int] = defaultdict(int)

    # Score from ALL mentions — time decay handles age (half-life), so a film
    # whose mentions are older than the window still stays ranked instead of
    # silently dropping out of the chart entirely. Previously the hard 48h
    # cutoff meant the ranked catalog shrank as mentions aged, leaving a
    # handful of films ranked and "the top 100" nearly empty.
    q = db.query(Mention)
    for m in q.yield_per(1000):
        w = source_weights.get(m.source_id, 1.0)
        age_h = max((now - _as_utc(m.created_at)).total_seconds() / 3600.0, 0.0)
        decay = _time_decay(age_h, half_life)
        raw[m.film_id] += w * math.log1p(max(m.engagement or 0, 0)) * decay
        if m.sentiment_score is not None:
            sentiment_sum[m.film_id] += m.sentiment_score
            sentiment_n[m.film_id] += 1

    boosted: dict[int, float] = {}
    for fid, score in raw.items():
        avg = sentiment_sum[fid] / sentiment_n[fid] if sentiment_n[fid] else 0.0
        boosted[fid] = score * (1 + 0.25 * avg)

    if not boosted:
        return now

    max_score = max(boosted.values()) or 1.0
    # Cap maximum score at 98.5 to ensure realistic non-perfect scores
    MAX_INDEX_SCORE = 98.5
    normalized = sorted(
        [(fid, round(s * MAX_INDEX_SCORE / max_score, 1)) for fid, s in boosted.items()],
        key=lambda x: -x[1],
    )

    # previous snapshot lookup for movement
    prev_snap = db.scalar(select(func.max(Ranking.snapshot_at)))
    prev_ranks: dict[int, int] = {}
    prev_peak: dict[int, int] = {}
    weeks_on: dict[int, int] = {}
    if prev_snap:
        for r in db.query(Ranking).filter(Ranking.snapshot_at == prev_snap):
            prev_ranks[r.film_id] = r.rank
            prev_peak[r.film_id] = r.peak_rank or r.rank
            weeks_on[r.film_id] = r.weeks_on_chart or 0

    for i, (fid, score) in enumerate(normalized, start=1):
        prev = prev_ranks.get(fid)
        peak = min(prev_peak.get(fid, i), i)
        db.add(Ranking(
            snapshot_at=now, film_id=fid, rank=i, score=score,
            prev_rank=prev, movement=(prev - i) if prev else 0,
            peak_rank=peak, weeks_on_chart=weeks_on.get(fid, 0) + 1,
        ))
    db.commit()
    return now
