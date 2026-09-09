"""TMDB Catalog Adapter — metadata provider only, never a ranking signal.

TMDB answers «"What is this piece of content?"»: titles, posters, dates,
genres, external ids. It must never answer «"How much cultural attention is
this getting?"». Accordingly this module ONLY upserts catalog rows — it does
not write Mention rows, and nothing in the ranking engine may read TMDB
popularity / vote counts / trending positions. (Popularity is used solely to
prioritize which catalog candidates get stored — a catalog curation choice,
not a score input.)

Content types are first-class: the same parameterized sync handles
``MOVIE`` and ``TV_SHOW``. TV shows are NOT movies with different dates —
they get their own TMDB feeds, their own genre map, their own creator
metadata, and their own (content_type, tmdb_id) identity.
"""
from datetime import datetime, timezone, date as date_type
import random
import time

import httpx
from slugify import slugify
from sqlalchemy import select, func

from app.config import settings
from app.models import Film, FilmAlias, Ranking
from app.models.film import CONTENT_TYPES, normalize_content_type
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

# TMDB MOVIE genre id → canonical Lumière genre tag. Priority order matters:
# when a title carries several genres the FIRST matching id in this list wins,
# so an animated sci-fi lands in Animation & Anime, and an action comedy in
# Action.
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

# TMDB TV genre ids are a DIFFERENT id space from movie genre ids — reusing the
# movie map would mislabel everything. e.g. 10765 is Sci-Fi & Fantasy (TV),
# 10759 is Action & Adventure (TV).
TMDB_TV_GENRE_MAP: list[tuple[int, str]] = [
    (16, "Animation"),     # Animation
    (10751, "Animation"),  # Family
    (10762, "Animation"),  # Kids
    (10765, "Sci-Fi"),     # Sci-Fi & Fantasy
    (9648, "Thriller"),    # Mystery
    (80, "Thriller"),      # Crime
    (10768, "Thriller"),   # War & Politics
    (10759, "Action"),     # Action & Adventure
    (10749, "Romance"),    # Romance (shared id)
    (35, "Comedy"),        # Comedy (shared id)
    (18, "Drama"),         # Drama (shared id)
    (10766, "Drama"),      # Soap
    (10764, "Drama"),      # Reality → closest shelf
    (99, "Indie"),         # Documentary (shared id)
    (37, "Western"),       # Western (shared id)
]

# Release-region → East Asian Cinema tag for titles whose origin country is
# Japan, South Korea, China, Taiwan, Hong Kong, or Thailand. These are
# explicitly mapped so East Asian Cinema is a real shelf, not a label with no data.
EAST_ASIAN_COUNTRIES = {"JP", "KR", "CN", "TW", "HK", "TH"}


def _east_asian_tag(country_code: str | None) -> str | None:
    """Return 'East Asian Cinema' when the title's origin country is East/Southeast Asian."""
    if not country_code:
        return None
    return "East Asian Cinema" if country_code.upper() in EAST_ASIAN_COUNTRIES else None


def genre_tag_from_tmdb(genre_ids: list[int] | None, content_type: str = "MOVIE") -> str | None:
    """Map TMDB genre ids to one canonical Lumière genre tag."""
    if not genre_ids:
        return None
    genre_map = TMDB_TV_GENRE_MAP if content_type == "TV_SHOW" else TMDB_GENRE_MAP
    id_set = set(genre_ids)
    for tmdb_id, tag in genre_map:
        if tmdb_id in id_set:
            return tag
    return None


# ── Global catalog coverage ───────────────────────────────────────────────────
# The default TMDB feeds are US-centric. To make the Index genuinely global we
# additionally pull current/upcoming titles for a spread of release regions and
# popular content by original language. Kept small enough that a full sync stays
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
    all_items: dict[int, dict] = {}

    def add(path: str, params: dict) -> None:
        data = _tmdb_get(
            f"https://api.themoviedb.org/3{path}",
            {"api_key": api_key, **params},
        )
        if not data:
            return
        for m in data.get("results", []):
            m_id = m.get("id")
            if m_id and m_id not in all_items:
                all_items[m_id] = m
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

    return list(all_items.values())


def fetch_tmdb_tv(api_key: str, pages: int = 3) -> list[dict]:
    """Fetch a broad, global TV catalog from TMDB.

    TV has its own feeds — reusing the movie endpoints would silently return
    an empty catalog:
      1. Global trending TV (week).
      2. US-default on-the-air / popular / top-rated feeds.
      3. Popular shows by original language via /discover/tv.
    """
    all_items: dict[int, dict] = {}

    def add(path: str, params: dict) -> None:
        data = _tmdb_get(
            f"https://api.themoviedb.org/3{path}",
            {"api_key": api_key, **params},
        )
        if not data:
            return
        for t in data.get("results", []):
            t_id = t.get("id")
            if t_id and t_id not in all_items:
                all_items[t_id] = t
        time.sleep(0.12)  # stay comfortably under the rate limit

    # 1. Global trending
    for page in range(1, min(pages, 2) + 1):
        add("/trending/tv/week", {"page": page})

    # 2. US-default TV feeds
    for page in range(1, pages + 1):
        add("/tv/on_the_air", {"page": page})
        add("/tv/popular", {"page": page})
    add("/tv/top_rated", {"page": 1})

    # 3. International popular TV (last 3 years)
    floor = (datetime.now(timezone.utc).date().replace(year=datetime.now(timezone.utc).year - 3)).isoformat()
    for lang in ORIGINAL_LANGUAGES:
        add(
            "/discover/tv",
            {
                "page": 1,
                "sort_by": "popularity.desc",
                "with_original_language": lang,
                "first_air_date.gte": floor,
                "vote_count.gte": 20,
            },
        )

    return list(all_items.values())


def _item_title(item: dict) -> str | None:
    """Title across movie (title/original_title) and TV (name/original_name) shapes."""
    return item.get("title") or item.get("name") or item.get("original_title") or item.get("original_name")


def _item_date_str(item: dict) -> str:
    """Release/air date string across both content shapes ('' when absent)."""
    return item.get("release_date") or item.get("first_air_date") or ""


def _item_country(item: dict) -> str | None:
    """Origin country code. TV list results carry ``origin_country`` as a list
    of country codes; movie list results usually omit it."""
    oc = item.get("origin_country") or []
    if oc and isinstance(oc, list):
        return oc[0] or None
    return None


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


def fetch_tv_creator(api_key: str, tmdb_id: int) -> str:
    """Fetch the show's primary creator from TMDB (the TV analogue of a director)."""
    url = f"https://api.themoviedb.org/3/tv/{tmdb_id}?api_key={api_key}"
    try:
        r = httpx.get(url, timeout=10)
        if r.status_code == 200:
            created_by = r.json().get("created_by", [])
            if created_by:
                return created_by[0].get("name", "")
    except Exception:
        pass
    return "Creator TBA"


def _unique_slug(db, base: str, tmdb_id: int) -> str:
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


def _upsert_content(db, item: dict, content_type: str) -> tuple[Film, bool]:
    """Create or refresh one catalog row from a TMDB list result.

    Identity is (content_type, tmdb_id): a movie id 1234 and a TV id 1234 are
    different titles and must coexist. Returns (film, created).
    """
    title = _item_title(item)
    tmdb_id = item.get("id")
    if not title or not tmdb_id:
        raise ValueError("TMDB item missing title or id")

    slug = slugify(title)
    if not slug:
        raise ValueError(f"empty slug for {title!r}")

    date_str = _item_date_str(item)
    year = int(date_str.split("-")[0]) if date_str and "-" in date_str else datetime.now(timezone.utc).year

    poster_path = item.get("poster_path")
    backdrop_path = item.get("backdrop_path")
    synopsis = item.get("overview") or f"{title} — {content_type.replace('_', ' ').title().lower()}."
    country = _item_country(item) or "US"
    raw_genre = genre_tag_from_tmdb(item.get("genre_ids"), content_type)
    # East Asian Cinema is a regional shelf, not a TMDB genre id — assign it
    # when the title's origin country is East/Southeast Asian. If TMDB gave us a
    # genre tag already we keep that (genre takes priority over region).
    genre_tag = raw_genre or _east_asian_tag(country)

    poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
    backdrop_url = f"https://image.tmdb.org/t/p/w1280{backdrop_path}" if backdrop_path else None

    original_title = item.get("original_title") or item.get("original_name") or title

    parsed_date = None
    if len(date_str) == 10:
        try:
            parsed_date = date_type.fromisoformat(date_str)
        except ValueError:
            pass

    film = (
        db.query(Film)
        .filter(Film.content_type == content_type, Film.tmdb_id == tmdb_id)
        .first()
    )
    if not film:
        # Legacy rows may exist without a tmdb_id; match on slug/title within
        # the same content type so we link instead of duplicating.
        film = (
            db.query(Film)
            .filter(Film.content_type == content_type)
            .filter((Film.slug == slug) | (Film.title == title))
            .first()
        )

    if not film:
        person = (
            fetch_movie_director(settings.tmdb_api_key, tmdb_id)
            if content_type == "MOVIE"
            else fetch_tv_creator(settings.tmdb_api_key, tmdb_id)
        )
        g1, g2 = random.choice(GRADIENT_PALETTES)

        film = Film(
            slug=_unique_slug(db, slug, tmdb_id),
            title=title,
            original_title=original_title,
            content_type=content_type,
            tmdb_id=tmdb_id,
            director=person,
            year=year,
            country_origin=country,
            poster_url=poster_url,
            backdrop_url=backdrop_url,
            synopsis=synopsis[:2000],
            gradient_from=g1,
            gradient_to=g2,
            release_date=parsed_date if content_type == "MOVIE" else None,
            first_air_date=parsed_date if content_type == "TV_SHOW" else None,
            genre_tag=genre_tag,
        )
        db.add(film)
        db.commit()
        db.refresh(film)

        # Add alias
        alias = FilmAlias(film_id=film.id, alias=title)
        if original_title and original_title != title:
            db.add(FilmAlias(film_id=film.id, alias=original_title))
        db.add(alias)
        db.commit()
        return film, True

    # Update fields (always refresh tmdb_id for legacy rows)
    changed = False
    if not film.tmdb_id:
        film.tmdb_id = tmdb_id
        changed = True
    if not film.original_title:
        film.original_title = original_title
        changed = True
    if poster_url and not film.poster_url:
        film.poster_url = poster_url
        changed = True
    if backdrop_url and not film.backdrop_url:
        film.backdrop_url = backdrop_url
        changed = True
    if synopsis and len(synopsis) > len(film.synopsis or ""):
        film.synopsis = synopsis[:2000]
        changed = True
    if genre_tag and not film.genre_tag:
        film.genre_tag = genre_tag
        changed = True
    # Fill the content-type date column if it was previously empty.
    if parsed_date is not None:
        if content_type == "MOVIE" and film.release_date is None:
            film.release_date = parsed_date
            changed = True
        elif content_type == "TV_SHOW" and film.first_air_date is None:
            film.first_air_date = parsed_date
            changed = True
    if changed:
        db.commit()
    return film, False


def sync_tmdb_catalog(
    db,
    max_films: int = 800,
    content_type: str = "MOVIE",
) -> list[Film]:
    """Fetch live content from TMDB, persist the catalog, and refresh rankings.

    Catalog-only: this function NEVER writes Mention rows. TMDB popularity is
    used exclusively to prioritize which candidates are stored (a curation
    choice) — it is not a ranking input.

    ``content_type`` selects the TMDB feeds and the identity space:
    ``MOVIE`` (default) or ``TV_SHOW``.
    """
    ct = normalize_content_type(content_type)
    if ct is None:
        raise ValueError("content_type is required — use MOVIE or TV_SHOW")

    api_key = settings.tmdb_api_key
    raw_items = (
        fetch_tmdb_movies(api_key, pages=5)
        if ct == "MOVIE"
        else fetch_tmdb_tv(api_key, pages=3)
    )

    synced_films: list[Film] = []
    newly_added = False  # becomes True if any catalog row is created

    # Sort by popularity descending — catalog prioritization ONLY. This decides
    # which titles get tracked at all; it never feeds a score.
    sorted_items = sorted(raw_items, key=lambda x: x.get("popularity", 0), reverse=True)[:max_films]

    for item in sorted_items:
        try:
            film, created = _upsert_content(db, item, ct)
        except ValueError:
            continue
        if created:
            newly_added = True
        synced_films.append(film)

    # Recompute the ranking snapshot immediately — but only when this sync
    # actually changed the catalog. On every restart the sync re-fetches the
    # same TMDB pages and adds nothing new; recomputing from identical data
    # produces a zero-movement snapshot that wipes out real movement between
    # refreshes. (New catalog rows with no signals yet simply enter at the
    # bottom of the next snapshot until real conversation accrues.)
    if newly_added or db.scalar(select(func.max(Ranking.snapshot_at))) is None:
        recompute_rankings(db)

    print(f"Successfully synced {len(synced_films)} {ct} titles from TMDB to the catalog.")
    return synced_films
