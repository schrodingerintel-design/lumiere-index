"""TMDB Movie Catalog Ingestion & Live Sync Adapter."""
from datetime import datetime, timezone, date as date_type
import random
import time

import httpx
from slugify import slugify
from sqlalchemy import select, func
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

# TMDB genre id → canonical Lumière genre tag. Priority order matters: when a
# film carries several genres the FIRST matching id in this list wins, so an
# animated sci-fi lands in Animation & Anime, and an action comedy in Action.
TMDB_GENRE_MAP: list[tuple[int, str]] = [
    (16, "Animation"),     # Animation
    (10751, "Animation"),  # Family → animated features dominate the family shelf
    (14, "Fantasy"),      # Fantasy
    (878, "Sci-Fi"),       # Science Fiction
    (27, "Horror"),        # Horror
    (53, "Thriller"),      # Thriller
    (9648, "Thriller"),    # Mystery
    (80, "Thriller"),      # Crime
    (10749, "Romance"),    # Romance
    (35, "Comedy"),        # Comedy
    (28, "Action"),        # Action
    (12, "Adventure"),     # Adventure
    (18, "Drama"),         # Drama
    (36, "Drama"),         # History
    (10402, "Drama"),      # Music
    (10770, "Drama"),      # TV Movie
    (99, "Indie"),         # Documentary → closest shelf
    (37, "Western"),       # Western
    (10752, "Thriller"),   # War
    (10759, "Action"),     # Action & Adventure (TV id, appears on movie results)
]

# Release-region → East Asian Cinema tag for films whose origin country is
# Japan, South Korea, China, Taiwan, Hong Kong, or Thailand. These are
# explicitly mapped so East Asian Cinema is a real shelf, not a label with no data.
EAST_ASIAN_COUNTRIES = {"JP", "KR", "CN", "TW", "HK", "TH"}


def _east_asian_tag(country_code: str | None) -> str | None:
    """Return 'East Asian Cinema' when the film's origin country is East/Southeast Asian."""
    if not country_code:
        return None
    return "East Asian Cinema" if country_code.upper() in EAST_ASIAN_COUNTRIES else None


def genre_tag_from_tmdb(genre_ids: list[int] | None) -> str | None:
    """Map TMDB genre ids to one canonical Lumière genre tag."""
    if not genre_ids:
        return None
    id_set = set(genre_ids)
    for tmdb_id, tag in TMDB_GENRE_MAP:
        if tmdb_id in id_set:
            return tag
    return None


# ── Global catalog coverage ───────────────────────────────────────────────────
# The default TMDB feeds are US-centric. To make the Index genuinely global we
# additionally pull now-playing/upcoming for a spread of release regions and
# popular cinema by original language. Kept small enough that a full sync stays
# well inside TMDB rate limits (~50 req / 10s): ~60 throttled requests total.
GLOBAL_REGIONS = ["GB", "FR", "DE", "JP", "KR", "IN", "BR", "MX", "ES", "IT", "AU", "NG"]
ORIGINAL_LANGUAGES = ["ja", "ko", "zh", "hi", "es", "fr", "de", "pt", "it", "tr", "ru", "sv"]


def _tmdb_get(url: str, params: dict) -> dict | None:
    """GET a TMDB endpoint with 429/5xx backoff. Returns parsed JSON or None."""
    for attempt in range(3):
        try:
            r = httpx.get(url, params=params, timeout=15)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(1.0 + attempt)  # back off and retry
                continue
            return None
        except Exception:
            time.sleep(0.5 + attempt)
    return None


def fetch_tmdb_movies(api_key: str, pages: int = 5) -> list[dict]:
    """Fetch a broad, global movie catalog from TMDB.

    Sources, deduplicated by TMDB id:
      1. Global trending (week) — region-agnostic by nature.
      2. US-default now-playing / popular / upcoming feeds.
      3. Now-playing + upcoming per release region (global theatrical spread).
      4. Popular films by original language via /discover (international cinema
         within the last 3 years, so the catalog stays contemporary).
    """
    all_movies: dict[int, dict] = {}

    def add(path: str, params: dict) -> None:
        data = _tmdb_get(
            f"https://api.themoviedb.org/3{path}",
            {"api_key": api_key, **params},
        )
        if not data:
            return
        for m in data.get("results", []):
            m_id = m.get("id")
            if m_id and m_id not in all_movies:
                all_movies[m_id] = m
        time.sleep(0.12)  # stay comfortably under the rate limit

    # 1. Global trending
    for page in range(1, min(pages, 3) + 1):
        add("/trending/movie/week", {"page": page})

    # 2. US-default feeds (broadest English-market coverage)
    for page in range(1, pages + 1):
        add("/movie/now_playing", {"page": page})
        add("/movie/popular", {"page": page})
    for page in range(1, min(pages, 3) + 1):
        add("/movie/upcoming", {"page": page})

    # 3. Regional theatrical feeds
    for region in GLOBAL_REGIONS:
        add("/movie/now_playing", {"page": 1, "region": region})
        add("/movie/upcoming", {"page": 1, "region": region})

    # 4. International popular cinema (last 3 years, some evidence of interest)
    floor = (datetime.now(timezone.utc).date().replace(year=datetime.now(timezone.utc).year - 3)).isoformat()
    for lang in ORIGINAL_LANGUAGES:
        add(
            "/discover/movie",
            {
                "page": 1,
                "sort_by": "popularity.desc",
                "with_original_language": lang,
                "primary_release_date.gte": floor,
                "vote_count.gte": 20,
            },
        )

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


def sync_tmdb_catalog(db: Session, max_films: int = 800) -> list[Film]:
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
        raw_genre = genre_tag_from_tmdb(item.get("genre_ids"))
        # East Asian Cinema is a regional shelf, not a TMDB genre id — assign it
        # when the film's origin country is East/Southeast Asian. If TMDB gave us a
        # genre tag already we keep that (genre takes priority over region).
        genre_tag = raw_genre or _east_asian_tag(country)

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
                genre_tag=genre_tag,
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
            if genre_tag and not film.genre_tag:
                film.genre_tag = genre_tag
            db.commit()

        synced_films.append(film)

        # Generate a mention signal for this movie based on TMDB popularity & vote average
        # Refreshed daily: vote_count/popularity are real platform observations
        # and they grow over time, so a daily refresh keeps the 30-day window
        # honest instead of aging out to zero after one month.
        pop = float(item.get("popularity", 50.0))
        vote_avg = float(item.get("vote_average", 7.0))
        vote_count = int(item.get("vote_count", 100))

        # Convert 0-10 vote average to -1 to +1 sentiment score
        sentiment_score = max(-1.0, min(1.0, (vote_avg - 5.0) / 5.0))
        sentiment_label = "positive" if sentiment_score > 0.1 else ("negative" if sentiment_score < -0.1 else "neutral")

        day_key = datetime.now(timezone.utc).strftime("%Y%m%d")
        ext_id = f"tmdb_popular_{film.id}_{tmdb_id}_{day_key}"

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
                # Real audience evidence: every TMDB rating is an observation.
                observations=vote_count,
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
    if newly_added or db.scalar(select(func.max(Ranking.snapshot_at))) is None:
        recompute_rankings(db)

    print(f"Successfully synced {len(synced_films)} live movies from TMDB API to database.")
    return synced_films
