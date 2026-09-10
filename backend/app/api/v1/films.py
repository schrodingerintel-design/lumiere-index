from datetime import datetime, timedelta, date, timezone
from difflib import SequenceMatcher
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select, func, desc, or_, and_
from sqlalchemy.orm import Session


from app.db import get_db
from app.models import Film, Ranking, Mention, DailyScore, CountryScore, Source
from app.models.film import normalize_content_type
from app.services.confidence import CATALOG_ONLY_SOURCE_KEYS
from app.schemas import (
    RankedFilm,
    FilmDetail,
    SentimentBreakdown,
    TimelinePoint,
    CountryScoreOut,
    SourceSignalBreakdown,
    SignalFunnel,
)
from app.utils.cache import cache_response

router = APIRouter()


def _catalog_source_ids(db: Session) -> list[int]:
    """Ids of catalog-only sources ("tmdb") — their rows are metadata, never
    signal volume, so they are excluded from every public count below."""
    return [
        sid for (sid,) in db.query(Source.id).filter(Source.key.in_(CATALOG_ONLY_SOURCE_KEYS)).all()
    ]


def _latest_snapshot(db: Session) -> datetime | None:
    return db.scalar(select(func.max(Ranking.snapshot_at)))


def _days_on_chart_map(db: Session, film_ids: list[int]) -> dict[int, int]:
    """Days on chart per film — calendar days since the title's FIRST
    appearance on the continuous 15-minute chart (min snapshot_at).

    Computed at read time from the snapshot history, so the number stays
    truthful and self-heals instead of carrying a counter. Titles never
    charted → 1 (today). Titles charted → floor(days since first appearance)
    + 1.
    """
    if not film_ids:
        return {}
    now = datetime.now(timezone.utc)
    first_seen: dict[int, datetime] = {
        fid: ts
        for fid, ts in db.query(Ranking.film_id, func.min(Ranking.snapshot_at))
        .filter(Ranking.film_id.in_(film_ids))
        .group_by(Ranking.film_id)
        .all()
    }
    out: dict[int, int] = {}
    for fid in film_ids:
        start = first_seen.get(fid)
        if start is None:
            out[fid] = 1
            continue
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        out[fid] = max(((now - start).days) + 1, 1)
    return out


def _ranked_query(db: Session, snapshot: datetime, genre: str | None = None):
    q = (
        db.query(Film, Ranking)
        .join(Ranking, Ranking.film_id == Film.id)
        .filter(Ranking.snapshot_at == snapshot)
        .order_by(Ranking.rank.asc())
    )
    if genre:
        q = q.filter(func.lower(Film.genre_tag) == genre.strip().lower())
    return q


def _to_ranked(film: Film, r: Ranking) -> RankedFilm:
    return RankedFilm(
        id=film.id, slug=film.slug, title=film.title,
        original_title=film.original_title, content_type=film.content_type,
        director=film.director or "Director TBA",
        year=film.year, country_origin=film.country_origin,
        poster_url=film.poster_url, backdrop_url=film.backdrop_url,
        synopsis=film.synopsis, gradient_from=film.gradient_from,
        gradient_to=film.gradient_to, release_date=film.release_date,
        first_air_date=film.first_air_date,
        genre_tag=film.genre_tag,
        rank=r.rank, score=r.score, prev_rank=r.prev_rank,
        movement=r.movement, peak_rank=r.peak_rank, weeks_on_chart=r.weeks_on_chart,
        ca_score=r.ca_score, momentum_score=r.momentum_score,
        recency_score=r.recency_score, ae_score=r.ae_score, cp_score=r.cp_score,
        sample_size=r.sample_size, confidence=r.confidence,
    )


def _mentions_map(db: Session, film_ids: list[int]) -> dict[int, int]:
    """Bulk mention counts within a 48-hour window, keyed by film id.

    Catalog-only sources ("tmdb") are excluded — TMDB metadata rows are not
    conversation volume."""
    if not film_ids:
        return {}
    since = datetime.now(timezone.utc) - timedelta(hours=48)
    q = (
        db.query(Mention.film_id, func.count(Mention.id).label("cnt"))
        .where(Mention.film_id.in_(film_ids), Mention.created_at >= since)
    )
    catalog_ids = _catalog_source_ids(db)
    if catalog_ids:
        q = q.filter(~Mention.source_id.in_(catalog_ids))
    rows = q.group_by(Mention.film_id).all()
    return {fid: int(cnt) for fid, cnt in rows}


def _with_mentions(rows, mentions: dict[int, int], days_map: dict[int, int] | None = None):
    return [
        _to_ranked(f, r).model_copy(update={
            "mentions_total": mentions.get(f.id, 0),
            **({"days_on_chart": (days_map or {}).get(f.id)} if days_map is not None else {}),
        })
        for f, r in rows
    ]


@router.get("/films/top", response_model=list[RankedFilm])
@cache_response(expire_seconds=60)
def top_films(
    request: Request,
    limit: int = Query(10, ge=1, le=200),
    offset: int = Query(0, ge=0),
    genre: str | None = Query(None, description="Filter to canonical genre_tag (case-insensitive)."),
    db: Session = Depends(get_db),
):
    snap = _latest_snapshot(db)
    if not snap:
        return []
    rows = _ranked_query(db, snap, genre=genre).offset(offset).limit(limit).all()
    mentions = _mentions_map(db, [f.id for f, _ in rows])
    days = _days_on_chart_map(db, [f.id for f, _ in rows])
    return _with_mentions(rows, mentions, days)


@router.get("/films/new-releases", response_model=list[RankedFilm])
@cache_response(expire_seconds=60)
def new_releases(
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    year_window: int = Query(2, ge=0, le=5),
    genre: str | None = Query(None, description="Filter to canonical genre_tag (case-insensitive)."),
    db: Session = Depends(get_db),
):
    snap = _latest_snapshot(db)
    if not snap:
        return []
    min_year = datetime.now(timezone.utc).year - year_window
    rows = (
        _ranked_query(db, snap, genre=genre)
        .filter(Film.year.isnot(None), Film.year >= min_year)
        .order_by(Ranking.score.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    mentions = _mentions_map(db, [f.id for f, _ in rows])
    # Canonical ranking: the rank shown here IS the official Index rank from the
    # latest snapshot. Renumbering by list position (enumerate) made every page
    # disagree with the canonical chart — "#1" on the Top 100 could be rank 7
    # on the film page and rank 12 in search. Every consumer reads the same row.
    days = _days_on_chart_map(db, [f.id for f, _ in rows])
    return [
        _to_ranked(f, r).model_copy(update={
            "mentions_total": mentions.get(f.id, 0),
            "days_on_chart": days.get(f.id),
        })
        for f, r in rows
    ]


@router.get("/films/rising", response_model=list[RankedFilm], deprecated=True)
def rising_films(
    response: Response,
    limit: int = Query(10, ge=1, le=200),
    offset: int = Query(0, ge=0),
    genre: str | None = Query(None, description="Filter to canonical genre_tag (case-insensitive)."),
    db: Session = Depends(get_db),
):
    """DEPRECATED — replaced by /api/v1/index/movers (Biggest Movers).

    Kept temporarily for backwards compatibility with existing clients.
    The Rising concept is no longer a primary ranking product; this endpoint
    now returns the biggest rank-based gainers from the published daily
    snapshot (same shape as before, minus fallback padding).  Clients should
    migrate to /api/v1/index/movers.
    """
    response.headers["Sunset"] = "Wed, 01 Oct 2026 00:00:00 GMT"
    response.headers["Deprecation"] = "true"
    snap = _latest_snapshot(db)
    if not snap:
        return []

    # Biggest rank-based gainers from the latest continuous snapshot —
    # identical semantics to Biggest Movers, minus the padded fallback rows
    # the old Rising product used to return.
    from datetime import date as _date
    cutoff = _date.today() - timedelta(days=90)
    rows = (
        _ranked_query(db, snap, genre=genre)
        .filter(Ranking.movement > 0)
        .order_by(desc(Ranking.movement))
        .offset(offset)
        .limit(limit)
        .all()
    )
    # Fallback: keep the response non-empty for older clients, but mark it.
    if len(rows) < limit:
        existing_ids = {f.id for f, _ in rows}
        q = _ranked_query(db, snap, genre=genre)
        if existing_ids:
            q = q.filter(~Film.id.in_(existing_ids))
        extra = q.limit(limit - len(rows)).all()
        rows = list(rows) + list(extra)

    mentions = _mentions_map(db, [f.id for f, _ in rows])
    result = []
    real_count = min(len(rows), limit)
    for i, (f, r) in enumerate(rows):
        result.append(
            _to_ranked(f, r).model_copy(update={
                "mentions_total": mentions.get(f.id, 0),
                "is_fallback": i >= real_count and r.movement <= 0,
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
    genre: str | None = Query(None, description="Filter to canonical genre_tag (case-insensitive)."),
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

    # Content-type aware: a title's "date" is release_date for movies and
    # first_air_date for shows. Both content types appear in New Releases.
    films = (
        db.query(Film)
        .filter(
            or_(
                and_(Film.content_type == "MOVIE", Film.release_date.isnot(None), Film.release_date >= cutoff),
                and_(Film.content_type == "TV_SHOW", Film.first_air_date.isnot(None), Film.first_air_date >= cutoff),
            )
        )
        .filter(func.lower(Film.genre_tag) == genre.strip().lower() if genre else True)
        .all()
    )
    recent = [f for f in films if f.air_date is not None and f.air_date <= today]
    upcoming = [f for f in films if f.air_date is not None and f.air_date > today]
    recent.sort(key=lambda f: (f.air_date or today), reverse=True)
    upcoming.sort(key=lambda f: (f.air_date or today))
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
                id=f.id, slug=f.slug, title=f.title,
                original_title=f.original_title, content_type=f.content_type,
                director=f.director or "Director TBA",
                year=f.year, country_origin=f.country_origin, poster_url=f.poster_url,
                backdrop_url=f.backdrop_url, synopsis=f.synopsis,
                gradient_from=f.gradient_from, gradient_to=f.gradient_to,
                release_date=f.release_date, first_air_date=f.first_air_date,
                genre_tag=f.genre_tag,
                rank=0, score=0.0,
            )
        result.append(item)
    return result


@router.get("/films/search", response_model=list[RankedFilm])
@cache_response(expire_seconds=30)
def search_films(
    request: Request,
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    genre: str | None = Query(None, description="Filter to canonical genre_tag (case-insensitive)."),
    content_type: str | None = Query(None, description="Filter by MOVIE or TV_SHOW."),
    db: Session = Depends(get_db),
):
    snap = _latest_snapshot(db)
    if not snap:
        return []

    pattern = f"%{q}%"
    genre_clause = func.lower(Film.genre_tag) == genre.strip().lower() if genre else True
    ct_clause = Film.content_type == normalize_content_type(content_type) if content_type else True
    films = db.query(Film).filter(Film.title.ilike(pattern), genre_clause, ct_clause).limit(limit).all()
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


def _signal_funnel(db: Session, film_id: int, days: int = 30) -> SignalFunnel:
    """Build the raw-observation funnel for one film.

    Distinguishes the three layers the audit demands:
      raw observations (upstream volume) → ingest records (what we stored) →
      per-source breakdown with collection timestamps. The Index Score itself
      stays normalized 0-100 regardless of volume.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = db.execute(
        select(
            Source.key,
            func.count(Mention.id),
            func.coalesce(func.sum(Mention.observations), 0),
            func.max(Mention.created_at),
        )
        .join(Source, Source.id == Mention.source_id)
        .where(Mention.film_id == film_id, Mention.created_at >= since)
        .group_by(Source.key)
    ).all()

    sources: list[SourceSignalBreakdown] = []
    total_obs = 0
    total_records = 0
    window_start: datetime | None = None
    for key, records, observations, last_at in rows:
        rec = int(records or 0)
        obs = int(observations or 0)
        total_records += rec
        total_obs += obs
        if last_at and (window_start is None or last_at < window_start):
            window_start = last_at
        sources.append(
            SourceSignalBreakdown(
                source_key=key,
                records=rec,
                observations=obs,
                last_collected_at=last_at,
            )
        )

    return SignalFunnel(
        raw_observations_30d=total_obs,
        ingest_records_30d=total_records,
        source_coverage=len(sources),
        window_start=window_start,
        window_end=datetime.now(timezone.utc) if total_records else None,
        sources=sources,
    )


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
    days_on_chart = _days_on_chart_map(db, [film.id]).get(film.id)
    # Sentiment split counts real audience conversation only — catalog-only
    # sources ("tmdb" vote rows) never contribute.
    catalog_ids = _catalog_source_ids(db)
    def _sent_count(label: str) -> int:
        q = select(func.count()).where(
            Mention.film_id == film.id, Mention.sentiment_label == label
        )
        if catalog_ids:
            q = q.where(~Mention.source_id.in_(catalog_ids))
        return db.scalar(q) or 0
    pos = _sent_count("positive")
    neu = _sent_count("neutral")
    neg = _sent_count("negative")
    
    total = pos + neu + neg
    if total >= 1:
        sentiment = SentimentBreakdown(
            positive=round(pos * 100 / total, 1),
            neutral=round(neu * 100 / total, 1),
            negative=round(neg * 100 / total, 1),
            sufficient_data=True,
        )
    else:
        sentiment = SentimentBreakdown()
    base = _to_ranked(film, r) if r else RankedFilm(
        id=film.id, slug=film.slug, title=film.title,
        original_title=film.original_title, content_type=film.content_type,
        director=film.director or "Director TBA",
        year=film.year, country_origin=film.country_origin, poster_url=film.poster_url,
        backdrop_url=film.backdrop_url, synopsis=film.synopsis,
        gradient_from=film.gradient_from, gradient_to=film.gradient_to,
        release_date=film.release_date, first_air_date=film.first_air_date,
        genre_tag=film.genre_tag,
        rank=0, score=0,
    )
    return FilmDetail(
        **base.model_dump(exclude={"mentions_total", "days_on_chart"}),
        mentions_total=mentions_total,
        days_on_chart=days_on_chart,
        sentiment=sentiment,
        signal_funnel=_signal_funnel(db, film.id),
    )


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
