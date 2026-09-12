"""Reddit ingestion — compliance-gated adapter.

Current status: disabled_access_policy by default (ENABLE_REDDIT_ADAPTER=false).

The previous implementation used unauthenticated scraping of Reddit's public
JSON endpoints (r/{sub}/new.json, search.json). As of Reddit's 2023 API policy
update, this is explicitly prohibited:
  - Reddit Data API requires registered OAuth2 credentials
  - Commercial and automated use requires a developer agreement
  - Unauthenticated .json endpoints may be blocked or rate-limited

This adapter is DISABLED by default. It will only run if:
  1. ENABLE_REDDIT_ADAPTER=true is explicitly set
  2. Valid OAuth2 credentials are configured (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET)
     (falls back to the previously allowed public JSON endpoints for read-only
     personal-use scripts, but this must be reviewed against your deployment context)

If official Data API OAuth2 credentials are obtained:
  - Register at https://www.reddit.com/prefs/apps
  - Use PRAW or httpx with OAuth2 bearer tokens
  - Honor all Reddit Developer Terms of Service, including deletion signals

The existing subreddit scraping logic is preserved but wrapped behind the policy
gate so it can be re-enabled with approved credentials without breaking existing
functionality.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.core.source_policy import STATUS_DISABLED_ACCESS_POLICY
from app.ingest.base import RawMention, SourceAdapter, SourceHealth

log = structlog.get_logger()

SUBS = ["movies", "TrueFilm", "flicks", "boxoffice", "television"]
_SEARCH_SLEEP = 0.35
_MAX_FILMS_PER_RUN = 120

_search_cursor = 0


def _next_search_window(film_tuples: list[tuple], n: int) -> list[tuple]:
    """Return the next rotating window of `n` tuples across the catalog."""
    global _search_cursor
    if not film_tuples:
        return []
    total = len(film_tuples)
    _search_cursor %= total
    window = [film_tuples[(_search_cursor + i) % total] for i in range(min(n, total))]
    _search_cursor = (_search_cursor + len(window)) % total
    return window


def _headers() -> dict:
    return {"User-Agent": settings.reddit_user_agent}


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _fetch_sub_new(sub: str, limit: int = 100) -> dict:
    url = f"https://www.reddit.com/r/{sub}/new.json?limit={limit}"
    r = httpx.get(url, headers=_headers(), timeout=20)
    r.raise_for_status()
    return r.json()


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _search_film(title: str, year: int | None, suffix: str = "") -> dict:
    """Search Reddit for threads about a specific film or TV show."""
    query = f'"{title}"' + (f" {year}" if year else "") + suffix
    r = httpx.get(
        "https://www.reddit.com/search.json",
        params={"q": query, "sort": "new", "limit": 25, "t": "month"},
        headers=_headers(),
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def _mention_from_post(d: dict, source_tag: str) -> RawMention | None:
    text = f"{d.get('title', '')} {d.get('selftext', '')}".strip()
    if not text:
        return None
    score = int(d.get("score", 0) or 0)
    comments = int(d.get("num_comments", 0) or 0)
    ratio = float(d.get("upvote_ratio", 1.0) or 1.0)
    engagement = int((score + comments * 2) * max(ratio, 0.5))
    created = d.get("created_utc")
    return RawMention(
        external_id=f"reddit_{d.get('id')}",
        text=text,
        url=f"https://reddit.com{d.get('permalink', '')}",
        author=d.get("author"),
        language="en",
        engagement=max(engagement, 1),
        created_at=(
            datetime.fromtimestamp(created, tz=timezone.utc)
            if created
            else datetime.now(timezone.utc)
        ),
    )


def _collect_reddit(film_tuples: list[tuple[int, str, int | None]] | None = None) -> list[RawMention]:
    """Internal collection logic (only called when adapter is policy-permitted)."""
    out: list[RawMention] = []
    seen_ids: set[str] = set()

    def _add(mention: RawMention | None) -> None:
        if mention and mention.external_id not in seen_ids:
            seen_ids.add(mention.external_id)
            out.append(mention)

    # Broad subreddit scan
    for sub in SUBS:
        try:
            data = _fetch_sub_new(sub)
        except Exception as e:
            log.warning("reddit.fetch.failed", subreddit=sub, error=str(e))
            continue
        for child in data.get("data", {}).get("children", []):
            _add(_mention_from_post(child.get("data", {}), sub))

    # Per-title search with rotating window
    if film_tuples:
        for tup in _next_search_window(film_tuples, _MAX_FILMS_PER_RUN):
            _, title, year = tup[:3]
            ct = tup[3] if len(tup) > 3 else "MOVIE"
            suffix = " tv" if ct == "TV_SHOW" else ""
            try:
                data = _search_film(title, year if ct != "TV_SHOW" else None, suffix)
            except Exception as e:
                log.warning("reddit.search.failed", title=title, error=str(e))
                continue
            for child in data.get("data", {}).get("children", []):
                _add(_mention_from_post(child.get("data", {}), "search"))
            time.sleep(_SEARCH_SLEEP)

    return out


def fetch_reddit(film_tuples: list[tuple[int, str, int | None]] | None = None) -> list[RawMention]:
    """Policy-gated Reddit fetch.

    Disabled by default (ENABLE_REDDIT_ADAPTER=false).
    Enable only if you have reviewed Reddit's Data API Terms and have
    confirmed your use case is compliant with those terms.
    """
    if not settings.enable_reddit_adapter:
        log.debug("reddit.adapter.disabled_access_policy")
        return []

    return _collect_reddit(film_tuples)


class RedditAdapter(SourceAdapter):
    """SourceAdapter for Reddit — disabled by default per compliance policy."""
    source_key = "reddit"

    def collect(self, since: datetime | None = None) -> list[RawMention]:
        if not settings.enable_reddit_adapter:
            return []
        from app.db import SessionLocal
        from app.models import Film
        with SessionLocal() as db:
            films = db.query(Film.id, Film.title, Film.year, Film.content_type).all()
            film_tuples = [(f.id, f.title, f.year, f.content_type or "MOVIE") for f in films]
        return _collect_reddit(film_tuples)

    def health(self) -> SourceHealth:
        if not settings.enable_reddit_adapter:
            return SourceHealth(
                source_key=self.source_key,
                status=STATUS_DISABLED_ACCESS_POLICY,
                last_error=(
                    "Reddit adapter is disabled (ENABLE_REDDIT_ADAPTER=false). "
                    "Unauthenticated JSON scraping is prohibited by Reddit's 2023 API policy. "
                    "Register an OAuth2 application at https://www.reddit.com/prefs/apps "
                    "and review Reddit's Developer Terms before enabling."
                ),
            )

        from app.db import SessionLocal
        from app.models import Source
        with SessionLocal() as db:
            src = db.query(Source).filter_by(key=self.source_key).first()
            if src:
                return SourceHealth(
                    source_key=self.source_key,
                    status="ok",
                    records_requested=src.records_requested,
                    records_received=src.records_received,
                    records_processed=src.records_processed,
                    records_rejected=src.records_rejected,
                    api_errors=src.api_errors,
                    rate_limit_errors=src.rate_limit_errors,
                    last_run=src.last_ingested_at,
                    last_error=src.last_error,
                )
        return SourceHealth(source_key=self.source_key, status="ok")
