"""Official Index API — the published chart layer.

Endpoints (all read from immutable published snapshots, never from the
continuous computation table):

  GET /api/v1/index               latest official Daily Index (?date= for history)
  GET /api/v1/index/weekly        latest official Weekly Index (?week_start= for history)
  GET /api/v1/index/movers        Biggest Movers (gainers + decliners)
  GET /api/v1/index/new-entries   films entering The Index for the first time

Backwards compatibility: the legacy /films/top, /films/rising and
/films/new-entries endpoints keep working.  /films/rising is marked
deprecated (response includes a Sunset header) — its concept is replaced by
/api/v1/index/movers.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import DailyIndexSnapshot, Film, IndexDebut, WeeklyIndexSnapshot
from app.schemas import (
    DailyIndexOut,
    IndexEntryOut,
    IndexMetaOut,
    MoverOut,
    MoversOut,
    NewEntryOut,
    WeeklyEntryOut,
    WeeklyIndexOut,
    WeeklyMetaOut,
)
from app.services.index_publication import biggest_movers, new_entries, week_bounds
from app.utils.cache import cache_response

router = APIRouter()


def _film_map(db: Session, film_ids: list[int]) -> dict[int, Film]:
    if not film_ids:
        return {}
    return {f.id: f for f in db.query(Film).filter(Film.id.in_(film_ids)).all()}


def _entry_out(film: Film, row: DailyIndexSnapshot) -> IndexEntryOut:
    return IndexEntryOut(
        film_id=row.film_id,
        slug=film.slug,
        title=film.title,
        director=film.director,
        year=film.year,
        poster_url=film.poster_url,
        backdrop_url=film.backdrop_url,
        gradient_from=film.gradient_from,
        gradient_to=film.gradient_to,
        release_date=film.release_date,
        genre_tag=film.genre_tag,
        rank=row.rank,
        score=row.score,
        previous_rank=row.previous_rank,
        rank_delta=row.rank_delta,
        score_delta=row.score_delta,
        signal_volume=row.signal_volume,
        confidence=row.confidence,
        source_coverage=row.source_coverage,
        sentiment_positive=row.sentiment_positive,
        sentiment_neutral=row.sentiment_neutral,
        sentiment_negative=row.sentiment_negative,
        snapshot_date=row.snapshot_date,
    )


def _weekly_entry_out(film: Film, row: WeeklyIndexSnapshot) -> WeeklyEntryOut:
    return WeeklyEntryOut(
        film_id=row.film_id,
        slug=film.slug,
        title=film.title,
        director=film.director,
        year=film.year,
        poster_url=film.poster_url,
        backdrop_url=film.backdrop_url,
        gradient_from=film.gradient_from,
        gradient_to=film.gradient_to,
        release_date=film.release_date,
        genre_tag=film.genre_tag,
        rank=row.rank,
        score=row.score,
        previous_week_rank=row.previous_week_rank,
        rank_delta=row.rank_delta,
        avg_daily_mentions=row.avg_daily_mentions,
        total_signal_volume=row.total_signal_volume,
        avg_sentiment=row.avg_sentiment,
        peak_daily_rank=row.peak_daily_rank,
        source_coverage=row.source_coverage,
        confidence=row.confidence,
        week_start=row.week_start,
        week_end=row.week_end,
    )


@router.get("/index", response_model=DailyIndexOut)
@cache_response(expire_seconds=60)
def daily_index(
    snapshot_date: date | None = Query(None, alias="date", description="Historical snapshot date (YYYY-MM-DD). Defaults to the latest published."),
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """The official Daily Index — latest published Top 100 (or a historical date)."""
    if snapshot_date is not None:
        target = snapshot_date
    else:
        target = db.scalar(select(func.max(DailyIndexSnapshot.snapshot_date)))
        if target is None:
            return DailyIndexOut(
                meta=IndexMetaOut(
                    snapshot_date=datetime.now(timezone.utc).date(),
                    published_at=None,
                    entry_count=0,
                ),
                entries=[],
            )

    q = (
        db.query(DailyIndexSnapshot)
        .filter(DailyIndexSnapshot.snapshot_date == target)
        .order_by(DailyIndexSnapshot.rank.asc())
    )
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    published_at = max((r.published_at for r in rows), default=None)
    films = _film_map(db, [r.film_id for r in rows])
    entries = [_entry_out(films[r.film_id], r) for r in rows if r.film_id in films]
    return DailyIndexOut(
        meta=IndexMetaOut(
            snapshot_date=target,
            published_at=published_at,
            entry_count=total,
        ),
        entries=entries,
    )


@router.get("/index/weekly", response_model=WeeklyIndexOut)
@cache_response(expire_seconds=60)
def weekly_index(
    week_start: date | None = Query(None, description="Historical week start (Monday, YYYY-MM-DD). Defaults to the latest published week."),
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """The official Weekly Index — latest published week (or a historical week)."""
    if week_start is not None:
        target = week_start
    else:
        target = db.scalar(select(func.max(WeeklyIndexSnapshot.week_start)))
        if target is None:
            monday, sunday = week_bounds(datetime.now(timezone.utc).date())
            return WeeklyIndexOut(
                meta=WeeklyMetaOut(week_start=monday, week_end=sunday, published_at=None, entry_count=0),
                entries=[],
            )

    q = (
        db.query(WeeklyIndexSnapshot)
        .filter(WeeklyIndexSnapshot.week_start == target)
        .order_by(WeeklyIndexSnapshot.rank.asc())
    )
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    published_at = max((r.published_at for r in rows), default=None)
    films = _film_map(db, [r.film_id for r in rows])
    entries = [_weekly_entry_out(films[r.film_id], r) for r in rows if r.film_id in films]
    week_end = rows[0].week_end if rows else target + timedelta(days=6)
    return WeeklyIndexOut(
        meta=WeeklyMetaOut(week_start=target, week_end=week_end, published_at=published_at, entry_count=total),
        entries=entries,
    )


@router.get("/index/movers", response_model=MoversOut)
@cache_response(expire_seconds=60)
def index_movers(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Biggest Movers — largest rank changes between published Daily Indexes.

    Movement is rank-position based; score delta is reported separately.
    """
    result = biggest_movers(db, limit=limit)
    return MoversOut(
        gainers=[
            MoverOut(
                slug=m.slug, title=m.title, poster_url=m.poster_url,
                direction=m.direction, movement=m.movement,
                previous_rank=m.previous_rank, current_rank=m.current_rank,
                current_score=m.current_score, previous_score=m.previous_score,
                score_delta=m.score_delta, confidence=m.confidence,
            )
            for m in result["gainers"]
        ],
        decliners=[
            MoverOut(
                slug=m.slug, title=m.title, poster_url=m.poster_url,
                direction=m.direction, movement=m.movement,
                previous_rank=m.previous_rank, current_rank=m.current_rank,
                current_score=m.current_score, previous_score=m.previous_score,
                score_delta=m.score_delta, confidence=m.confidence,
            )
            for m in result["decliners"]
        ],
    )


@router.get("/index/new-entries", response_model=list[NewEntryOut])
@cache_response(expire_seconds=60)
def index_new_entries(
    limit: int = Query(20, ge=1, le=100),
    days: int | None = Query(None, ge=1, le=365, description="Restrict to debuts within the last N days."),
    db: Session = Depends(get_db),
):
    """New Entries — films making their first-ever appearance on The Index.

    A film debuts exactly once; it never repeats as a New Entry.
    """
    debut_rows = new_entries(db, limit=limit, days=days)
    # Current ranks come from the latest published daily (may be absent).
    latest_date = db.scalar(select(func.max(DailyIndexSnapshot.snapshot_date)))
    current_ranks: dict[int, int] = {}
    if latest_date is not None:
        for fid, rank in db.query(
            DailyIndexSnapshot.film_id, DailyIndexSnapshot.rank
        ).filter(DailyIndexSnapshot.snapshot_date == latest_date).all():
            current_ranks[fid] = rank

    out: list[NewEntryOut] = []
    for debut, film in debut_rows:
        out.append(NewEntryOut(
            slug=film.slug,
            title=film.title,
            director=film.director,
            year=film.year,
            poster_url=film.poster_url,
            gradient_from=film.gradient_from,
            gradient_to=film.gradient_to,
            release_date=film.release_date,
            debut_date=debut.debut_date,
            debut_rank=debut.debut_rank,
            debut_score=debut.debut_score,
            current_rank=current_ranks.get(film.id),
            confidence=debut.confidence,
            signal_volume=debut.signal_volume,
        ))
    return out
