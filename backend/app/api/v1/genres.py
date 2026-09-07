from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Film, Ranking
from app.schemas import RankedFilm

router = APIRouter()


GENRE_LABELS: dict[str, str] = {
    "action": "Action",
    "adventure": "Adventure",
    "animation": "Animation",
    "anime": "Anime",
    "comedy": "Comedy",
    "crime": "Crime",
    "documentary": "Documentary",
    "drama": "Drama",
    "east-asian-cinema": "East Asian Cinema",
    "fantasy": "Fantasy",
    "adventure": "Adventure",
    "fantasy": "Fantasy",
    "horror": "Horror",
    "indie": "Indie",
    "musical": "Musical",
    "romance": "Romance",
    "sci-fi": "Sci-Fi",
    "thriller": "Thriller",
    "western": "Western",
}


def _latest_snapshot(db: Session):
    return db.scalar(select(func.max(Ranking.snapshot_at)))


def _ranked_query(db: Session, snapshot):
    return (
        db.query(Film, Ranking)
        .join(Ranking, Ranking.film_id == Film.id)
        .filter(Ranking.snapshot_at == snapshot)
        .order_by(Ranking.rank.asc())
    )


def _to_ranked(film: Film, r: Ranking) -> RankedFilm:
    return RankedFilm(
        id=film.id, slug=film.slug, title=film.title,
        director=film.director or "Director TBA",
        year=film.year, country_origin=film.country_origin,
        poster_url=film.poster_url, backdrop_url=film.backdrop_url,
        synopsis=film.synopsis, gradient_from=film.gradient_from,
        gradient_to=film.gradient_to, release_date=film.release_date,
        genre_tag=film.genre_tag,
        rank=r.rank, score=r.score, prev_rank=r.prev_rank,
        movement=r.movement, peak_rank=r.peak_rank,
        weeks_on_chart=r.weeks_on_chart,
        ca_score=r.ca_score, momentum_score=r.momentum_score,
        recency_score=r.recency_score, ae_score=r.ae_score,
        cp_score=r.cp_score, sample_size=r.sample_size,
        confidence=r.confidence,
    )


@router.get("/genres", tags=["genres"])
def genre_list(db: Session = Depends(get_db)):
    """Canonical genre tags currently represented in the Index, with film counts.

    The frontend uses this to render the "Explore by Genre" section. Labels are
    human-readable; `tag` is the canonical value the frontend filters on.
    """
    snap = _latest_snapshot(db)
    if not snap:
        return []

    rows = (
        db.query(Film.genre_tag, func.count(Film.id).label("cnt"))
        .filter(Film.genre_tag.isnot(None), Film.genre_tag != "")
        .join(Ranking, Ranking.film_id == Film.id)
        .filter(Ranking.snapshot_at == snap)
        .group_by(Film.genre_tag)
        .all()
    )

    out = []
    for tag, cnt in rows:
        tag = (tag or "").strip().lower()
        if not tag:
            continue
        out.append({
            "tag": tag,
            "label": GENRE_LABELS.get(tag, tag.replace("_", " ").title()),
            "count": int(cnt),
        })
    out.sort(key=lambda g: (-g["count"], g["label"]))
    return out


@router.get("/genres/{tag}/films", response_model=list[RankedFilm], tags=["genres"])
def genre_films(
    tag: str,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Ranked films whose canonical `genre_tag` matches `tag` (case-insensitive).

    Returns the same `RankedFilm` shape as `/films/top`, so the genre collection
    cards can render identically to the rest of the Index.
    """
    snap = _latest_snapshot(db)
    if not snap:
        return []

    rows = (
        _ranked_query(db, snap)
        .filter(func.lower(Film.genre_tag) == tag.strip().lower())
        .offset(offset)
        .limit(limit)
        .all()
    )
    # An empty shelf is a valid state (sparse catalog for a genre), not an
    # error — the frontend renders "not enough titles yet" for empty lists.
    # Returning 404 here made every sparse collection look like a broken page.
    return [_to_ranked(f, r) for f, r in rows]
