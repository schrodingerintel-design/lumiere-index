"""TMDB Movie Catalog Ingestion & Live Sync Adapter."""
from datetime import datetime, timezone, date as date_type
import random
import httpx
from slugify import slugify
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Film, FilmAlias, Source, Mention, Ranking
from app.services.ranking import recompute_rankings

GRADIENT_PALETTES = [
    ("#1e3a5f", "#0a192f"),
    ("#7a1f2b", "#1a1a18"),
    ("#0f4c5c", "#051923"),
    ("#e36414", "#1a1a18"),
    ("#5f0f40", "#1a0510"),
    ("#2a3a2a", "#0a120a"),
    ("#4a1525", "#15050a"),
    ("#1d6fa5", "#0a1f33"),
    ("#3a3a5a", "#101020"),
    ("#d5b352", "#2b1f0a"),
    ("#5a2a5a", "#1a0a1a"),
    ("#2d8a86", "#0b2422"),
]


def fetch_tmdb_movies(api_key: str, pages: int = 5) -> list[dict]:
    """Fetch trending, now playing, popular, and upcoming movies from TMDB API."""

    all_movies: dict[int, dict] = {}

    endpoints = [
        f"https://api.themoviedb.org/3/trending/movie/week?api_key={api_key}",
        f"https://api.themoviedb.org/3/movie/now_playing?api_key={api_key}",
        f"https://api.themoviedb.org/3/movie/popular?api_key={api_key}",
        f"https://api.themoviedb.org/3/movie/upcoming?api_key={api_key}",
    ]

    for endpoint in endpoints:
        for page in range(1, pages + 1):
            try:
                url = f"{endpoint}&page={page}"
                r = httpx.get(url, timeout=15)
                if r.status_code == 200:
                    data = r.json()
                    for m in data.get("results", []):
                        m_id = m.get("id")
                        if m_id and m_id not in all_movies:
                            all_movies[m_id] = m
            except Exception:
                continue

    return list(all_movies.values())


def fetch_movie_director(api_key: str, tmdb_id: int) -> str:
    """Fetch movie director from TMDB credits endpoint."""
    url = f"https://api.themoviedb.org/3/movie/{tmdb_id}/credits?api_key={api_key}"
    try:
        r = httpx.get(url, timeout=10)
        if r.status_code == 200:
            crew = r.json().get("crew", [])
            for member in crew:
                if member.get("job") == "Director":
                    return member.get("name", "")
    except Exception:
        pass
    return "Director TBA"


def _unique_slug(db: Session, base: str, tmdb_id: int) -> str:
    """Return a slug guaranteed to be unique in the films table."""
    if not db.query(Film).filter_by(slug=base).first():
        return base
    candidate = f"{base}-{tmdb_id}"
    if not db.query(Film).filter_by(slug=candidate).first():
        return candidate
    i = 1
    while db.query(Film).filter_by(slug=f"{base}-{tmdb_id}-{i}").first():
        i += 1
    return f"{base}-{tmdb_id}-{i}"


def sync_tmdb_catalog(db: Session, max_films: int = 100) -> list[Film]:
    """Fetch live trending movies from TMDB API, persist to DB, and compute initial rankings.

    Upserts are keyed by TMDB id (when available) to avoid slug-collision bugs
    ("F1" vs "F1: The Movie") and to stay idempotent across scheduled runs.
    """
    api_key = settings.tmdb_api_key
    raw_movies = fetch_tmdb_movies(api_key, pages=5)

    # Ensure tmdb source exists in DB
    tmdb_src = db.query(Source).filter_by(key="tmdb").first()
    if not tmdb_src:
        tmdb_src = Source(key="tmdb", name="TMDB", weight=1.4)
        db.add(tmdb_src)
        db.commit()
        db.refresh(tmdb_src)

    synced_films: list[Film] = []
    newly_added = False  # becomes True if any film or mention is created

    # Sort by popularity descending
    sorted_movies = sorted(raw_movies, key=lambda x: x.get("popularity", 0), reverse=True)[:max_films]

    for item in sorted_movies:
        title = item.get("title") or item.get("original_title")
        tmdb_id = item.get("id")
        if not title or not tmdb_id:
            continue

        slug = slugify(title)
        if not slug:
            continue

        # Parse release year
        release_date = item.get("release_date", "")
        year = int(release_date.split("-")[0]) if release_date and "-" in release_date else datetime.now(timezone.utc).year

        poster_path = item.get("poster_path")
        backdrop_path = item.get("backdrop_path")
        synopsis = item.get("overview") or f"{title} film."
        country = (item.get("origin_country") or ["US"])[0] if item.get("origin_country") else "US"

        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
        backdrop_url = f"https://image.tmdb.org/t/p/w1280{backdrop_path}" if backdrop_path else None

        # Find by TMDB id first (dedupe), then fall back to slug/title for legacy rows
        film = db.query(Film).filter_by(tmdb_id=tmdb_id).first()
        if not film:
            film = db.query(Film).filter((Film.slug == slug) | (Film.title == title)).first()

        if not film:
            director = fetch_movie_director(api_key, tmdb_id)
            g1, g2 = random.choice(GRADIENT_PALETTES)

            parsed_release_date = None
            if release_date and len(release_date) == 10:
                try:
                    parsed_release_date = date_type.fromisoformat(release_date)
                except ValueError:
                    pass

            film = Film(
                slug=_unique_slug(db, slug, tmdb_id),
                title=title,
                tmdb_id=tmdb_id,
                director=director,
                year=year,
                country_origin=country,
                poster_url=poster_url,
                backdrop_url=backdrop_url,
                synopsis=synopsis[:2000],
                gradient_from=g1,
                gradient_to=g2,
                release_date=parsed_release_date,
            )
            db.add(film)
            db.commit()
            db.refresh(film)
            newly_added = True

            # Add alias
            alias = FilmAlias(film_id=film.id, alias=title)
            db.add(alias)
            db.commit()
        else:
            # Update fields (always refresh tmdb_id for legacy rows)
            if not film.tmdb_id:
                film.tmdb_id = tmdb_id
            if poster_url and not film.poster_url:
                film.poster_url = poster_url
            if backdrop_url and not film.backdrop_url:
                film.backdrop_url = backdrop_url
            if synopsis and len(synopsis) > len(film.synopsis or ""):
                film.synopsis = synopsis[:2000]
            db.commit()

        synced_films.append(film)

        # Generate a mention signal for this movie based on TMDB popularity & vote average
        pop = float(item.get("popularity", 50.0))
        vote_avg = float(item.get("vote_average", 7.0))
        vote_count = int(item.get("vote_count", 100))

        # Convert 0-10 vote average to -1 to +1 sentiment score
        sentiment_score = max(-1.0, min(1.0, (vote_avg - 5.0) / 5.0))
        sentiment_label = "positive" if sentiment_score > 0.1 else ("negative" if sentiment_score < -0.1 else "neutral")

        ext_id = f"tmdb_popular_{film.id}_{tmdb_id}"

        existing_mention = db.query(Mention).filter_by(external_id=ext_id).first()
        if not existing_mention:
            newly_added = True
            m = Mention(
                film_id=film.id,
                source_id=tmdb_src.id,
                external_id=ext_id,
                url=f"https://www.themoviedb.org/movie/{tmdb_id}",
                author="TMDB",
                country_code=country,
                language="en",
                text=f"{title} ratings on TMDB: {vote_avg}/10 across {vote_count} reviews. Popularity index: {pop}.",
                sentiment_score=sentiment_score,
                sentiment_label=sentiment_label,
                engagement=int(pop * 10 + vote_count),
                created_at=datetime.now(timezone.utc),
            )
            db.add(m)
            db.commit()

    # Record source health
    tmdb_src.last_ingested_at = datetime.now(timezone.utc)
    tmdb_src.last_error = None
    db.commit()

    # Recompute rankings snapshot immediately — but only when this sync actually
    # changed the catalog. On every restart the sync re-fetches the same TMDB
    # pages and adds nothing new; recomputing from identical data produces a
    # zero-movement snapshot that wipes out real movement between refreshes.
    if newly_added:
        recompute_rankings(db)

    print(f"Successfully synced {len(synced_films)} live movies from TMDB API to database.")
    return synced_films
