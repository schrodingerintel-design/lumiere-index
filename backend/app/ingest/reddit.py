"""Reddit ingestion.

Two complementary channels:
  1. Subreddit /new feeds (r/movies, r/TrueFilm, r/flicks) — broad conversation
     scan, matched to films by title.
  2. Per-film search via reddit's public JSON search API — finds threads
     *about* a film even when they never hit the big subreddits.

Both run at the cadence set by the scheduler; every record carries real
engagement (score + num_comments + upvote_ratio weighted) and per-film
searches are throttled to stay well inside reddit's rate limits.
"""
from datetime import datetime, timezone
import time

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.ingest.base import RawMention

log = structlog.get_logger()

SUBS = ["movies", "TrueFilm", "flicks", "boxoffice"]
_SEARCH_SLEEP = 0.35  # seconds between per-film searches (rate-limit friendly)
_MAX_FILMS_PER_RUN = 120  # keep a full run inside ~1 minute


def _headers() -> dict:
    return {"User-Agent": settings.reddit_user_agent}


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _fetch_sub_new(sub: str, limit: int = 100) -> dict:
    url = f"https://www.reddit.com/r/{sub}/new.json?limit={limit}"
    r = httpx.get(url, headers=_headers(), timeout=20)
    r.raise_for_status()
    return r.json()


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _search_film(title: str, year: int | None) -> dict:
    """Search all of reddit for threads about a specific film."""
    query = f'"{title}"' + (f" {year}" if year else "")
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
    # Real engagement: upvotes × participation, ratio-weighted. This is the
    # platform's own measure of how many people interacted with the thread.
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


def fetch_reddit(film_tuples: list[tuple[int, str, int | None]] | None = None) -> list[RawMention]:
    """Fetch subreddit feeds plus per-film search threads.

    `film_tuples` is optional so the existing Celery/scheduler task keeps
    working; when provided it enables the per-film search channel.
    """
    out: list[RawMention] = []
    seen_ids: set[str] = set()

    def _add(mention: RawMention | None) -> None:
        if mention and mention.external_id not in seen_ids:
            seen_ids.add(mention.external_id)
            out.append(mention)

    # 1. Broad subreddit scan (conversation matching by title).
    for sub in SUBS:
        try:
            data = _fetch_sub_new(sub)
        except Exception as e:
            log.warning("reddit.fetch.failed", subreddit=sub, error=str(e))
            continue
        for child in data.get("data", {}).get("children", []):
            _add(_mention_from_post(child.get("data", {}), sub))

    # 2. Per-film search — finds dedicated threads about each tracked film.
    if film_tuples:
        for _, title, year in film_tuples[:_MAX_FILMS_PER_RUN]:
            try:
                data = _search_film(title, year)
            except Exception as e:
                log.warning("reddit.search.failed", title=title, error=str(e))
                continue
            for child in data.get("data", {}).get("children", []):
                _add(_mention_from_post(child.get("data", {}), "search"))
            time.sleep(_SEARCH_SLEEP)

    return out
