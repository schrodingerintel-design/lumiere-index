from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Film, Ranking
from app.api.v1.films import _chart_for_content_type, _days_on_chart_map, _days_at_one_map
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


def _catalog_films(db: Session, tag: str | None = None) -> list[Film]:
    """All catalogue titles, optionally scoped to one canonical genre tag.

    Catalogue membership is independent of chart membership — a title does
    not need a rank to belong to a genre shelf.
    """
    q = db.query(Film).filter(Film.genre_tag.isnot(None), Film.genre_tag != "")
    if tag:
        q = q.filter(func.lower(Film.genre_tag) == tag.strip().lower())
    return q.all()


def _to_ranked(film: Film, r: Ranking | None) -> RankedFilm:
    """Serialize a catalogue title. When it sits on its OWN official chart,
    carry that chart-scoped rank; otherwise rank 0 / score 0 — the contract
    the frontend renders as "Not currently ranked"."""
    if r is not None:
        return RankedFilm(
            id=film.id, slug=film.slug, title=film.title,
            original_title=film.original_title,
            content_type=film.content_type,
            director=film.director or "Director TBA",
            year=film.year, country_origin=film.country_origin,
            poster_url=film.poster_url, backdrop_url=film.backdrop_url,
            synopsis=film.synopsis, gradient_from=film.gradient_from,
            gradient_to=film.gradient_to, release_date=film.release_date,
            first_air_date=film.first_air_date,
            genre_tag=film.genre_tag,
            rank=r.rank, score=r.score, chart_type=r.chart_type,
            prev_rank=r.prev_rank, movement=r.movement,
            peak_rank=r.peak_rank, weeks_on_chart=r.weeks_on_chart,
            ca_score=r.ca_score, momentum_score=r.momentum_score,
            recency_score=r.recency_score, ae_score=r.ae_score,
            cp_score=r.cp_score, sample_size=r.sample_size,
            confidence=r.confidence,
        )
    return RankedFilm(
        id=film.id, slug=film.slug, title=film.title,
        original_title=film.original_title,
        content_type=film.content_type,
        director=film.director or "Director TBA",
        year=film.year, country_origin=film.country_origin,
        poster_url=film.poster_url, backdrop_url=film.backdrop_url,
        synopsis=film.synopsis, gradient_from=film.gradient_from,
        gradient_to=film.gradient_to, release_date=film.release_date,
        first_air_date=film.first_air_date,
        genre_tag=film.genre_tag,
        rank=0, score=0.0,
    )


@router.get("/genres", tags=["genres"])
def genre_list(db: Session = Depends(get_db)):
    """Canonical genre tags represented in the CATALOGUE, with title counts.

    Counts come from the catalogue, not the charts — the genre browse page
    must show every title a collection holds, ranked or not. Labels are
    human-readable; `tag` is the canonical value the frontend filters on.
    """
    rows = (
        db.query(Film.genre_tag, func.count(Film.id).label("cnt"))
        .filter(Film.genre_tag.isnot(None), Film.genre_tag != "")
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
    """All catalogue titles whose canonical `genre_tag` matches `tag`.

    CHART MEMBERSHIP AND CATALOGUE MEMBERSHIP ARE INDEPENDENT. The genre
    shelf lists every matching catalogue title; a title carries a rank only
    if it currently sits on its own official chart (Movie 100 / TV 100) —
    never an internal candidate position. Unranked titles return rank 0 /
    score 0, which clients render as "Not currently ranked".

    Ordering: ranked titles by rank, then unranked titles by Index score
    where one exists historically, then alphabetically.
    """
    films = _catalog_films(db, tag)
    if not films:
        # An empty shelf is a valid state (sparse catalogue for a genre), not
        # an error — the frontend renders "not enough titles yet" for empty
        # lists. Returning 404 here made every sparse collection look broken.
        return []

    snap = _latest_snapshot(db)
    film_ids = [f.id for f in films]
    content_type_by_id = {f.id: f.content_type for f in films}

    # Chart-scoped ranks: one Ranking row per title on its OWN chart.
    ranked_rows: dict[int, Ranking] = {}
    if snap:
        for r in db.query(Ranking).filter(
            Ranking.film_id.in_(film_ids),
            Ranking.snapshot_at == snap,
            Ranking.rank >= 1,
            Ranking.rank <= 100,
        ).all():
            expected = _chart_for_content_type(content_type_by_id.get(r.film_id))
            if r.chart_type == expected:
                ranked_rows[r.film_id] = r

    # Best historical Index score, so unranked titles still sort meaningfully.
    last_scores: dict[int, float] = {
        fid: float(score or 0.0) for fid, score in db.query(
            Ranking.film_id, func.max(Ranking.score)
        ).filter(Ranking.film_id.in_(film_ids)).group_by(Ranking.film_id).all()
    }

    days = _days_on_chart_map(db, film_ids, chart_type=None)
    at_one = _days_at_one_map(db, film_ids, chart_type=None)

    def _sort_key(f: Film):
        r = ranked_rows.get(f.id)
        if r:
            return (0, r.rank, f.title.lower())
        # Unranked: most recent measured score first (0 for never-charted),
        # then alphabetical for a stable list.
        return (1, -last_scores.get(f.id, 0.0), f.title.lower())

    ordered = sorted(films, key=_sort_key)[offset : offset + limit]

    return [
        _to_ranked(f, ranked_rows.get(f.id)).model_copy(update={
            # Chart tenure only exists for charted titles — unranked catalogue
            # titles must not report "1 day on chart".
            "days_on_chart": days.get(f.id) if f.id in ranked_rows else None,
            "days_at_one": at_one.get(f.id) if f.id in ranked_rows else None,
        })
        for f in ordered
    ]
