"""Candidate discovery: turn unmatched mentions into new films via TMDB search.

When ``ingest_batch`` cannot match a mention to an existing film, it queues the
raw mention in ``pending_mentions``. This module's ``discover_candidates`` job:

1. extracts candidate film-title phrases from each pending text,
2. searches TMDB (server-side, capped and rate-limited),
3. resolves the mention to an existing film, or creates a new film + alias and
   re-ingests the mention against it.

This is how the index grows organically from conversation: Reddit/Letterboxd
users start talking about a film before it appears in any chart.
"""
from __future__ import annotations

import random
import re
from datetime import date, datetime, timezone

import httpx
from slugify import slugify
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Film, FilmAlias, Mention, PendingMention, Source
from app.services.sentiment import score_text
from app.ingest.tmdb import GRADIENT_PALETTES, _unique_slug
from app.ingest.pipeline import invalidate_matcher_cache

_QUOTE_RE = re.compile(r'"([^"]{2,80})"')
_SQUOTE_RE = re.compile(r"'([^']{2,80})'")
_GUILLEMET_RE = re.compile(r"«([^»]{2,80})»")

# Title-Case runs: 1-6 capitalized words (optionally followed by a year)
_CAP_RUN_RE = re.compile(
    r"\b([A-ZÀ-Þ][\wÀ-ÿ&'.\-]*(?:\s+(?:[A-ZÀ-Þ][\wÀ-ÿ&'.\-]*|\d{4})){0,5})\b"
)
_YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")

# Words that almost never belong in a movie title candidate
_STOP = frozenset({
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with",
    "by", "from", "is", "are", "was", "were", "be", "been", "this", "that",
    "these", "those", "it", "its", "i", "you", "we", "they", "he", "she", "him",
    "her", "his", "my", "your", "our", "as", "so", "but", "not", "no", "yes",
    "new", "now", "just", "all", "who", "what", "when", "where", "why", "how",
    "if", "then", "than", "film", "movie", "movies", "films", "cinema",
    "director", "directed", "directing", "trailer", "review", "reviews",
    "watch", "watching", "watched", "streaming", "theater", "theatre",
    "theaters", "theatres", "screening", "release", "released", "releases",
    "premiere", "premieres", "oscar", "oscars", "award", "awards", "imdb",
    "rotten", "tomatoes", "box", "office", "sequel", "sequels", "franchise",
    "franchises", "adaptation", "cast", "stars", "starring", "actors", "actress",
    "netflix", "amazon", "disney", "paramount", "warner", "studios", "studio",
    "available", "exclusive", "sneak", "peek", "teaser", "footage", "clip",
    "scene", "score", "soundtrack", "full", "official", "best", "worst",
    "great", "good", "bad", "love", "hate", "finally", "ever", "first", "still",
    "story", "plot", "vs", "tv", "series", "part", "chapter", "volume", "act",
})

_MIN_SIMILARITY = 0.6


def extract_candidates(text: str, limit: int = 5) -> list[str]:
    """Extract candidate film-title phrases from free text.

    Quoted strings are strongest, then Title-Case phrase runs. Candidates are
    deduped (case-insensitive) and filtered against stopwords / cinema words.
    """
    if not text:
        return []
    candidates: list[str] = []
    seen: set[str] = set()

    def _add(cand: str) -> None:
        cand = cand.strip().strip(".,:;!?—–-").strip()
        if len(cand) < 2 or len(cand) > 80:
            return
        key = cand.lower()
        if key in seen:
            return
        tokens = [t for t in re.findall(r"[a-z0-9&']+", key)]
        if not tokens or all(t in _STOP for t in tokens):
            return
        seen.add(key)
        candidates.append(cand)

    # 1. Quoted / guillemet strings
    for m in _QUOTE_RE.finditer(text):
        _add(m.group(1))
    for m in _SQUOTE_RE.finditer(text):
        _add(m.group(1))
    for m in _GUILLEMET_RE.finditer(text):
        _add(m.group(1))

    # 2. Title-Case phrase runs (longest first is handled by sort below)
    for m in _CAP_RUN_RE.finditer(text):
        phrase = m.group(1)
        tokens = phrase.split()
        # skip phrases that are entirely stopwords
        if not any(t.strip(".,") not in _STOP for t in tokens):
            continue
        _add(phrase)

    # Prefer quoted candidates; then longest title-case runs (better precision).
    return candidates[:limit]


def search_tmdb(query: str, api_key: str) -> list[dict]:
    """Search TMDB movies; returns raw result items (empty on error)."""
    url = "https://api.themoviedb.org/3/search/movie"
    try:
        r = httpx.get(url, params={"api_key": api_key, "query": query, "language": "en-US"}, timeout=10)
        if r.status_code == 200:
            return r.json().get("results", [])
    except Exception:
        pass
    return []


def _token_set(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _title_similarity(a: str, b: str) -> float:
    A, B = _token_set(a), _token_set(b)
    if not A or not B:
        return 0.0
    return len(A & B) / len(A | B)


def _find_year(text: str) -> int | None:
    for m in _YEAR_RE.finditer(text):
        y = int(m.group(1))
        if 1980 <= y <= datetime.now(timezone.utc).year + 2:
            return y
    return None


def _result_year(item: dict) -> int | None:
    rd = item.get("release_date") or ""
    if len(rd) >= 4 and rd[:4].isdigit():
        return int(rd[:4])
    return None


def _plausible(cand: str, item: dict, text_year: int | None) -> bool:
    title = item.get("title") or item.get("original_title") or ""
    sim = _title_similarity(cand, title)
    if sim >= _MIN_SIMILARITY:
        if text_year is None:
            return True
        res_year = _result_year(item)
        return res_year is None or abs(res_year - text_year) <= 2
    if 0.4 <= sim < _MIN_SIMILARITY and text_year is not None:
        res_year = _result_year(item)
        return res_year is not None and abs(res_year - text_year) <= 1
    return False


def _create_film(db: Session, item: dict, candidate: str) -> Film:
    """Create a Film from a TMDB result and alias the candidate title."""
    title = item.get("title") or item.get("original_title") or candidate
    release_date = item.get("release_date") or ""
    year = int(release_date.split("-")[0]) if "-" in release_date and release_date.split("-")[0].isdigit() else None
    parsed_release_date = None
    if len(release_date) == 10:
        try:
            parsed_release_date = date.fromisoformat(release_date)
        except ValueError:
            pass

    poster_path = item.get("poster_path")
    backdrop_path = item.get("backdrop_path")
    poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
    backdrop_url = f"https://image.tmdb.org/t/p/w1280{backdrop_path}" if backdrop_path else None
    country = (item.get("origin_country") or ["US"])[0] if item.get("origin_country") else "US"
    overview = item.get("overview") or f"{title} film."
    g1, g2 = random.choice(GRADIENT_PALETTES)

    film = Film(
        slug=_unique_slug(db, slugify(title), item.get("id")),
        title=title,
        tmdb_id=item.get("id"),
        director="Director TBA",
        year=year,
        country_origin=country,
        poster_url=poster_url,
        backdrop_url=backdrop_url,
        synopsis=overview[:2000],
        gradient_from=g1,
        gradient_to=g2,
        release_date=parsed_release_date,
    )
    db.add(film)
    db.flush()

    db.add_all([
        FilmAlias(film_id=film.id, alias=title),
        FilmAlias(film_id=film.id, alias=candidate),
    ])
    db.commit()
    db.refresh(film)
    return film


def _insert_mention(db: Session, pending: PendingMention, film_id: int) -> None:
    """Re-ingest the pending mention against the resolved film."""
    src = db.get(Source, pending.source_id)
    if not src:
        return
    if db.query(Mention.id).filter_by(source_id=src.id, external_id=pending.external_id).first():
        return
    score, label = score_text(pending.text or "")
    db.add(Mention(
        film_id=film_id, source_id=src.id, external_id=pending.external_id,
        url=pending.url, author=pending.author, country_code=pending.country_code,
        language=pending.language, text=(pending.text or "")[:5000],
        sentiment_score=score, sentiment_label=label,
        engagement=pending.engagement, created_at=pending.created_at,
    ))


def discover_candidates(db: Session, limit: int = 50, tmdb_limit: int = 30) -> int:
    """Process pending mentions, creating new films from plausible TMDB hits.

    Returns the number of films created. Search quota is capped by
    ``tmdb_limit``; remaining mentions stay ``pending`` for the next run.
    """
    if not settings.tmdb_api_key:
        return 0

    pending = (
        db.query(PendingMention)
        .filter_by(status="pending")
        .order_by(PendingMention.created_at.asc())
        .limit(limit)
        .all()
    )

    created = 0
    searches = 0
    for p in pending:
        if searches >= tmdb_limit:
            break

        text_year = _find_year(p.text or "")
        resolved = False
        for cand in extract_candidates(p.text):
            if searches >= tmdb_limit:
                break
            searches += 1
            results = search_tmdb(cand, settings.tmdb_api_key)
            for item in results:
                if not _plausible(cand, item, text_year):
                    continue
                tmdb_id = item.get("id")
                existing = db.query(Film).filter_by(tmdb_id=tmdb_id).first()
                film_id = existing.id if existing else None
                if film_id is None:
                    film = _create_film(db, item, cand)
                    film_id = film.id
                    created += 1
                _insert_mention(db, p, film_id)
                p.status = "resolved"
                p.film_id = film_id
                p.resolved_at = datetime.now(timezone.utc)
                db.commit()
                resolved = True
                break
            if resolved:
                break

        if not resolved and searches < tmdb_limit:
            # No plausible film found for any candidate — record as rejected.
            p.status = "rejected"
            p.resolved_at = datetime.now(timezone.utc)
            db.commit()

    if created:
        invalidate_matcher_cache()
    return created
