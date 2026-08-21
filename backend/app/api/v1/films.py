from datetime import datetime, timedelta, date, timezone
from difflib import SequenceMatcher
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Film, Ranking, Mention, DailyScore, CountryScore
from app.schemas import RankedFilm, FilmDetail, SentimentBreakdown, TimelinePoint, CountryScoreOut
from app.utils.cache import cache_response

router = APIRouter()


def _latest_snapshot(db: Session) -> datetime | None:
    return db.scalar(select(func.max(Ranking.snapshot_at)))


def _ranked_query(db: Session, snapshot: datetime):
    return (
        db.query(Film, Ranking)
        .join(Ranking, Ranking.film_id == Film.id)
        .filter(Ranking.snapshot_at == snapshot)
        .order_by(Ranking.rank.asc())
    )


def _to_ranked(film: Film, r: Ranking) -> RankedFilm:
    return RankedFilm(
        id=film.id, slug=film.slug, title=film.title, director=film.director or "Director TBA",
        year=film.year, country_origin=film.country_origin,
        poster_url=film.poster_url, backdrop_url=film.backdrop_url,
        synopsis=film.synopsis, gradient_from=film.gradient_from,
        gradient_to=film.gradient_to, release_date=film.release_date,
        rank=r.rank, score=r.score, prev_rank=r.prev_rank,
        movement=r.movement, peak_rank=r.peak_rank, weeks_on_chart=r.weeks_on_chart,
    )


def _mentions_map(db: Session, film_ids: list[int]) -> dict[int, int]:
    """Bulk mention counts within the ranking window, keyed by film id."""
    if not film_ids:
        return {}
    since = datetime.now(timezone.utc) - timedelta(hours=settings.ranking_window_hours)
    rows = (
        db.query(Mention.film_id, func.count(Mention.id).label("cnt"))
        .where(Mention.film_id.in_(film_ids), Mention.created_at >= since)
        .group_by(Mention.film_id)
        .all()
    )
    return {fid: int(cnt) for fid, cnt in rows}


def _with_mentions(rows, mentions: dict[int, int]):
    return [
        _to_ranked(f, r).model_copy(update={"mentions_total": mentions.get(f.id, 0)})
        for f, r in rows
    ]


@router.get("/films/top", response_model=list[RankedFilm])
@cache_response(expire_seconds=60)
def top_films(
    request: Request,
    limit: int = Query(10, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    snap = _latest_snapshot(db)
    if not snap:
        return []
    rows = _ranked_query(db, snap).offset(offset).limit(limit).all()
    mentions = _mentions_map(db, [f.id for f, _ in rows])
    return _with_mentions(rows, mentions)


@router.get("/films/new-releases", response_model=list[RankedFilm])
@cache_response(expire_seconds=60)
def new_releases(
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    year_window: int = Query(2, ge=0, le=5),
    db: Session = Depends(get_db),
):
    snap = _latest_snapshot(db)
    if not snap:
        return []
    min_year = datetime.now(timezone.utc).year - year_window
    rows = (
        _ranked_query(db, snap)
        .filter(Film.year.isnot(None), Film.year >= min_year)
        .order_by(Ranking.score.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    mentions = _mentions_map(db, [f.id for f, _ in rows])
    return [
        _to_ranked(f, r).model_copy(update={"rank": i, "mentions_total": mentions.get(f.id, 0)})
        for i, (f, r) in enumerate(rows, start=offset + 1)
    ]


@router.get("/films/rising", response_model=list[RankedFilm])
def rising_films(
    limit: int = Query(10, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    snap = _latest_snapshot(db)
    if not snap:
        return []

    # Prefer films with positive movement
    rows = (
        _ranked_query(db, snap)
        .filter(Ranking.movement > 0)
        .order_by(desc(Ranking.movement))
        .offset(offset)
        .limit(limit)
        .all()
    )
    real_count = len(rows)

    # Fallback to top-ranked films if positive movers are sparse — tagged is_fallback=True
    if real_count < limit:
        existing_ids = {f.id for f, _ in rows}
        q = _ranked_query(db, snap)
        if existing_ids:
            q = q.filter(~Film.id.in_(existing_ids))
        extra_rows = q.limit(limit - real_count).all()
        rows = list(rows) + list(extra_rows)

    mentions = _mentions_map(db, [f.id for f, _ in rows])
    result = []
    for i, (f, r) in enumerate(rows):
        is_fallback = i >= real_count
        result.append(
            _to_ranked(f, r).model_copy(update={
                "mentions_total": mentions.get(f.id, 0),
                "is_fallback": is_fallback,
            })
        )
    return result


@router.get("/films/new-entries", response_model=list[RankedFilm])
@cache_response(expire_seconds=60)
def new_entries(
    request: Request,
    days: int = Query(30, ge=1, le=90),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Films released within the last `days` days, then upcoming releases (soonest first).

    Includes films that haven't charted yet (rank 0), so a film that just hit
    theaters appears even before its first ranking snapshot.
    """
    snap = _latest_snapshot(db)
    if not snap:
        return []

    today = date.today()
    cutoff = today - timedelta(days=days)

    films = (
        db.query(Film)
        .filter(Film.release_date.isnot(None), Film.release_date >= cutoff)
        .all()
    )
    recent = [f for f in films if f.release_date <= today]
    upcoming = [f for f in films if f.release_date > today]
    recent.sort(key=lambda f: (f.release_date or today), reverse=True)
    upcoming.sort(key=lambda f: (f.release_date or today))
    ordered = (recent + upcoming)[offset : offset + limit]

    rankings = {
        r.film_id: r
        for r in db.query(Ranking).filter(
            Ranking.film_id.in_([f.id for f in ordered]),
            Ranking.snapshot_at == snap,
        ).all()
    }
    mentions = _mentions_map(db, [f.id for f in ordered])

    result = []
    for f in ordered:
        r = rankings.get(f.id)
        if r:
            item = _to_ranked(f, r).model_copy(update={"mentions_total": mentions.get(f.id, 0)})
        else:
            item = RankedFilm(
                id=f.id, slug=f.slug, title=f.title, director=f.director or "Director TBA",
                year=f.year, country_origin=f.country_origin, poster_url=f.poster_url,
                backdrop_url=f.backdrop_url, synopsis=f.synopsis,
                gradient_from=f.gradient_from, gradient_to=f.gradient_to,
                release_date=f.release_date, rank=0, score=0.0,
            )
        result.append(item)
    return result


@router.get("/films/search", response_model=list[RankedFilm])
@cache_response(expire_seconds=30)
def search_films(
    request: Request,
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    snap = _latest_snapshot(db)
    if not snap:
        return []

    pattern = f"%{q}%"
    films = db.query(Film).filter(Film.title.ilike(pattern)).limit(limit).all()
    if not films:
        # No direct match — surface similar titles (typo tolerance) so a near
        # miss still lands on something relevant. The caller tells the user
        # "no exact match" and shows these as closest matches. Cap at 6 so
        # the "similar results" list stays focused on the best candidates
        # instead of a long tail of weak character overlaps.
        films = _fuzzy_search(db, q, min(limit, 6))
    if not films:
        return []

    film_ids = [f.id for f in films]
    rankings = {
        r.film_id: r
        for r in db.query(Ranking).filter(
            Ranking.film_id.in_(film_ids), Ranking.snapshot_at == snap
        ).all()
    }

    results = []
    for f in films:
        r = rankings.get(f.id)
        if r:
            results.append((f, r))
    mentions = _mentions_map(db, [f.id for f, _ in results])
    return _with_mentions(results, mentions)


def _title_similarity(a: str, b: str) -> float:
    """Case-insensitive similarity ratio (0.0 – 1.0) for typo-tolerant search."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _fuzzy_search(db: Session, q: str, limit: int) -> list[Film]:
    """Return catalog films ranked by title similarity to `q` when a direct match fails.

    Scores each film by the best match between the query and any individual
    title word (so "avtar" → "avatar" beats incidental full-title character
    overlap), blended with the full-title ratio for multi-word closeness.
    """
    q_lower = q.lower()
    scored = []
    for f in db.query(Film).all():
        title = (f.title or "").lower()
        slug_words = (f.slug or "").replace("-", " ").lower()
        corpus = (title + " " + slug_words).split()
        word_sim = max((_title_similarity(q, w) for w in corpus), default=0.0)
        full_sim = _title_similarity(q, title)
        # Word match dominates; full-title overlap is a tiebreaker.
        sim = max(word_sim, full_sim * 0.8)
        if sim >= 0.45:
            scored.append((sim, f))
    scored.sort(key=lambda x: -x[0])
    return [f for _, f in scored[:limit]]


@router.get("/films/{slug}", response_model=FilmDetail)
def film_detail(slug: str, db: Session = Depends(get_db)):
    film = db.scalar(select(Film).where(Film.slug == slug))
    if not film:
        raise HTTPException(404, "Film not found")
    snap = _latest_snapshot(db)
    r = db.scalar(
        select(Ranking).where(Ranking.film_id == film.id, Ranking.snapshot_at == snap)
    ) if snap else None
    mentions_total = _mentions_map(db, [film.id]).get(film.id, 0)
    pos = db.scalar(select(func.count()).where(Mention.film_id == film.id, Mention.sentiment_label == "positive")) or 0
    neu = db.scalar(select(func.count()).where(Mention.film_id == film.id, Mention.sentiment_label == "neutral")) or 0
    neg = db.scalar(select(func.count()).where(Mention.film_id == film.id, Mention.sentiment_label == "negative")) or 0
    
    total = pos + neu + neg
    if total >= 3:
        sentiment = SentimentBreakdown(
            positive=round(pos * 100 / total, 1),
            neutral=round(neu * 100 / total, 1),
            negative=round(neg * 100 / total, 1),
            sufficient_data=True,
        )
    else:
        sentiment = SentimentBreakdown()
    base = _to_ranked(film, r) if r else RankedFilm(
        id=film.id, slug=film.slug, title=film.title, director=film.director or "Director TBA",
        year=film.year, country_origin=film.country_origin, poster_url=film.poster_url,
        backdrop_url=film.backdrop_url, synopsis=film.synopsis,
        gradient_from=film.gradient_from, gradient_to=film.gradient_to,
        rank=0, score=0,
    )
    return FilmDetail(**base.model_dump(exclude={"mentions_total"}), mentions_total=mentions_total, sentiment=sentiment)


@router.get("/films/{slug}/timeline", response_model=list[TimelinePoint])
def film_timeline(slug: str, days: int = 30, db: Session = Depends(get_db)):
    film = db.scalar(select(Film).where(Film.slug == slug))
    if not film:
        raise HTTPException(404, "Film not found")
    cutoff = date.today() - timedelta(days=days)
    rows = (
        db.query(DailyScore)
        .filter(DailyScore.film_id == film.id, DailyScore.day >= cutoff)
        .order_by(DailyScore.day.asc())
        .all()
    )
    return [TimelinePoint(day=r.day, mentions=r.mentions_count, score=r.weighted_score) for r in rows]


@router.get("/films/{slug}/countries", response_model=list[CountryScoreOut])
def film_countries(slug: str, days: int = 7, db: Session = Depends(get_db)):
    film = db.scalar(select(Film).where(Film.slug == slug))
    if not film:
        raise HTTPException(404, "Film not found")
    cutoff = date.today() - timedelta(days=days)
    rows = (
        db.query(
            CountryScore.country_code,
            func.sum(CountryScore.mentions_count).label("m"),
            func.sum(CountryScore.score).label("s"),
        )
        .filter(CountryScore.film_id == film.id, CountryScore.day >= cutoff)
        .group_by(CountryScore.country_code)
        .order_by(desc("s"))
        .limit(20)
        .all()
    )
    return [CountryScoreOut(country_code=cc, mentions=int(m or 0), score=float(s or 0)) for cc, m, s in rows]
