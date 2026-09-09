"""News ingestion via NewsAPI.

Every published article is a real observation of media attention, so each
record carries at least 1 observation. Queries rotate across general film
coverage and per-film searches (round-robin) so headline volume reflects what
is actually being written about while staying inside the free developer tier
(100 requests/day → a 15-min cadence means one request per run is the safe
budget; we use it on a rotating query window).
"""
from datetime import datetime, timedelta, timezone
import itertools
import time

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.ingest.base import RawMention

# One request per run is the free-tier-safe budget at a 15-min cadence.
_MAX_QUERIES_PER_RUN = 1
_PAGE_SIZE = 100

# Round-robin cursor shared by every run in this process: each run picks up
# where the last one left off, so over a day the full tracked catalog cycles
# through the query slot.
_query_cycle: itertools.cycle | None = None
_cycle_key_count = 0


def _build_queries(film_tuples: list[tuple[int, str, int | None]]) -> list[tuple[str, str | None]]:
    """Query window: general coverage first, then one query per tracked film."""
    queries: list[tuple[str, str | None]] = [
        ("film OR movie OR cinema", None),
        ("film release OR box office", None),
    ]
    for _, title, year in film_tuples:
        queries.append((f'"{title}"', title))
    return queries


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _fetch(q: str, from_dt: datetime | None) -> dict:
    params: dict = {
        "q": q,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": _PAGE_SIZE,
    }
    if from_dt:
        # Free tier restricts to the last 30 days anyway; requesting a window
        # keeps repeats meaningful instead of re-listing the same headlines.
        params["from"] = from_dt.strftime("%Y-%m-%d")
    r = httpx.get(
        "https://newsapi.org/v2/everything",
        params=params,
        headers={"X-Api-Key": settings.newsapi_key},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def fetch_news(film_tuples: list[tuple[int, str, int | None]] | None = None) -> list[RawMention]:
    """Fetch articles for the rotating query window.

    `film_tuples` is optional so the existing Celery/scheduler task keeps
    working; when provided it enables per-film query rotation.
    """
    if not settings.newsapi_key:
        return []

    global _query_cycle, _cycle_key_count
    queries = _build_queries(film_tuples or [])
    if not queries:
        return []

    if _query_cycle is None or _cycle_key_count != len(queries):
        _query_cycle = itertools.cycle(queries)
        _cycle_key_count = len(queries)

    from_dt = datetime.now(timezone.utc) - timedelta(hours=48)

    out: list[RawMention] = []
    for _ in range(_MAX_QUERIES_PER_RUN):
        query, film_title = next(_query_cycle)
        try:
            data = _fetch(query, from_dt)
        except Exception:
            continue
        for a in data.get("articles", []):
            text = f"{a.get('title', '')} {a.get('description', '') or ''}".strip()
            if not text:
                continue
            published = a.get("publishedAt")
            try:
                created = datetime.fromisoformat(published.replace("Z", "+00:00"))
            except Exception:
                created = datetime.now(timezone.utc)
            out.append(
                RawMention(
                    external_id=f"news_{a.get('url')}",
                    text=text,
                    url=a.get("url"),
                    author=(a.get("source") or {}).get("name"),
                    language="en",
                    # The article itself is the observation. Extra weight when
                    # it names the film we matched it to.
                    engagement=2 if film_title else 1,
                    created_at=created,
                )
            )
        time.sleep(0.3)

    return out
