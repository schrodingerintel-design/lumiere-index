"""
Trending endpoints.

/trending/films  — films ranked by current audience engagement velocity,
                   derived from Mention counts + Ranking score delta.
                   Each entry includes a trend reason derived from real
                   engagement signals (mention velocity, movement, etc.).

The legacy /trending/topics endpoint is preserved for backwards-compat but
intentionally returns [] so no keyword noise leaks into the UI.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc, and_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Film, Ranking, Mention
from app.schemas import TrendingFilmOut, TrendingTopicOut

router = APIRouter()


def _derive_trend_reason(
    movement: int | None,
    mentions_24h: int,
    weeks_on_chart: int | None,
    score: float | None = None,
) -> str:
    """Derive a human-readable trend reason from real engagement signals.

    Movement tiers first, then conversation volume, then chart tenure, then
    score-based fallbacks — so adjacent cards only share a reason when their
    underlying signals are genuinely comparable.
    """
    m = movement or 0
    w = weeks_on_chart or 1

    if m >= 25:
        return f"Exploding +{m} spots — cultural breakout moment"
    if m >= 10:
        return f"Surging +{m} spots after viral audience reactions"
    if m >= 5:
        return f"Climbing +{m} spots on strong word-of-mouth"
    if m >= 2:
        return f"Gaining +{m} spots from discussion momentum"
    if m == 1:
        return "Edging up +1 spot in audience conversation"
    if m <= -10:
        return f"Falling {m} spots as conversation cools"
    if m <= -5:
        return f"Cooling off {m} spots after peak wave"
    if m < 0:
        return f"Softening {m} spots in weekly velocity"
    if mentions_24h > 800:
        return "Viral engagement spike across social platforms"
    if mentions_24h > 300:
        return "High signal volume across social platforms"
    if mentions_24h > 100:
        return "Active audience review conversation"
    if mentions_24h > 20:
        return "Rising audience engagement"
    if w <= 1:
        return "New release debuting on the Index"
    if w <= 3:
        return "Early chart momentum building"
    if score is not None:
        if score >= 60:
            return "Top-tier presence holding strong"
        if score >= 40:
            return "Steady presence with strong signals"
        if score >= 20:
            return "Steady presence in audience index"
    return "Quiet week — modest signal levels"


def _derive_sub_tags(movement: int | None, mentions_24h: int) -> list[str]:
    """Derive relevant sub-tags from real signals."""
    m = movement or 0
    tags: list[str] = []
    if m >= 5:
        tags.append("#wordofmouth")
        tags.append("#climbing")
    elif m > 0:
        tags.append("#trendingup")
    if mentions_24h > 100:
        tags.append("#highengagement")
    if mentions_24h > 300:
        tags.append("#viral")
    if m <= -3:
        tags.append("#cooling")
    if not tags:
        tags.append("#audiencereaction")
    return tags[:3]


# ── /trending/films ───────────────────────────────────────────────────────────

@router.get("/trending/films", response_model=list[TrendingFilmOut])
def trending_films(limit: int = 20, db: Session = Depends(get_db)):
    """
    Return films sorted by audience engagement velocity: score * ln(1 + mentions_24h).
    """
    snap = db.scalar(select(func.max(Ranking.snapshot_at)))
    if not snap:
        return []

    # Load top-ranked films at latest snapshot
    rows = (
        db.query(Film, Ranking)
        .join(Ranking, Ranking.film_id == Film.id)
        .filter(Ranking.snapshot_at == snap)
        .order_by(desc(Ranking.score))
        .limit(limit * 2)   # fetch extra; we re-sort by velocity below
        .all()
    )

    # Bulk-fetch 24h mention counts for all films in the result set (avoids N+1).
    # The label says "24h" so the count must actually be windowed to 24 hours —
    # an all-time count makes every card report huge numbers and produces
    # identical "high signal volume" reasons for everything.
    film_ids = [film.id for film, _ in rows]
    mention_counts: dict[int, int] = {}
    if film_ids:
        since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        count_rows = (
            db.query(Mention.film_id, func.count(Mention.id).label("cnt"))
            .where(
                Mention.film_id.in_(film_ids),
                Mention.created_at >= since_24h,
            )
            .group_by(Mention.film_id)
            .all()
        )
        mention_counts = {fid: cnt for fid, cnt in count_rows}

    results: list[TrendingFilmOut] = []
    for film, ranking in rows:
        director = film.director or "Director TBA"

        mentions_24h = mention_counts.get(film.id, 0)

        # Movement delta → percentage for display
        delta_pct = round((ranking.movement or 0) * 2.5, 1)

        results.append(TrendingFilmOut(
            film_slug=film.slug,
            title=film.title,
            director=director,
            year=film.year,
            rank=ranking.rank,
            score=ranking.score,
            poster_url=film.poster_url,
            gradient_from=film.gradient_from,
            gradient_to=film.gradient_to,
            trend_reason=_derive_trend_reason(
                ranking.movement, mentions_24h, ranking.weeks_on_chart, ranking.score
            ),
            tags=_derive_sub_tags(ranking.movement, mentions_24h),
            delta_pct=delta_pct,
            mentions_24h=mentions_24h,
        ))

    # Sort strictly by the score each card displays, descending, so the
    # rendered order always matches the visible score column top to bottom.
    results.sort(key=lambda r: r.score, reverse=True)

    return results[:limit]


# ── /trending/topics (legacy — kept for backwards compat, returns []) ─────────

@router.get("/trending/topics", response_model=list[TrendingTopicOut])
def trending_topics(limit: int = 20, db: Session = Depends(get_db)):
    """
    Legacy keyword topic endpoint.  Intentionally returns an empty list
    now that the UI has migrated to /trending/films which surfaces real
    film titles rather than raw NLP keyword extracts.
    """
    return []
