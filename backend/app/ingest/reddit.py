"""Reddit ingestion.

Two complementary channels:
  1. Subreddit /new feeds (r/movies, r/TrueFilm, r/flicks, r/television) —
     broad conversation scan, matched to tracked titles by name.
  2. Per-title search via reddit's public JSON search API — finds threads
     *about* a tracked film or TV show even when they never hit the big
     subreddits.

Both run at the cadence set by the scheduler; every record carries real
engagement (score + num_comments + upvote_ratio weighted) and per-title
searches are throttled to stay well inside reddit's rate limits. The
per-title search window ROTATES across runs so the whole catalog — TV
shows included, which were previously starved by a fixed first-120 window —
gets searched on a regular cycle.
"""
from datetime import datetime, timezone
import time

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.ingest.base import RawMention

log = structlog.get_logger()

SUBS = ["movies", "TrueFilm", "flicks", "boxoffice", "television"]
_SEARCH_SLEEP = 0.35  # seconds between per-title searches (rate-limit friendly)
_MAX_FILMS_PER_RUN = 120  # keep a full run inside ~1 minute

# Round-robin cursor over the tracked catalog: each run searches the next
# window of 120 titles, so TV shows (synced after movies, high ids) are no
# longer permanently outside the search window.
_search_cursor = 0


def _next_search_window(
    film_tuples: list[tuple], n: int
) -> list[tuple]:
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
    """Search reddit for threads about a specific film or TV show."""
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

    # 2. Per-title search — rotating window over the WHOLE catalog (movies AND
    #    TV shows), so later-synced content is searched on a regular cycle.
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
