"""Wikipedia pageview ingestion adapter using Wikimedia REST API.

Pageviews are real per-day observations of public attention. We resolve the
film's actual article via the opensearch API (so "Dracula" lands on
"Dracula (2025 film)", not the novel) and pull a 30-day daily series, emitting
one idempotent record per (article, day). The 30-day rolling window then
carries the film's full attention history instead of a single day.
"""
from datetime import datetime, timedelta, timezone

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.ingest.base import RawMention

_WIKI_API = "https://en.wikipedia.org/w/api.php"
_PAGEVIEWS_URL = (
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
    "en.wikipedia/all-access/all-agents/{article}/daily/{start}/{end}"
)
_DAYS = 30


def _headers() -> dict:
    return {"User-Agent": settings.reddit_user_agent or "LumiereIndex/1.0 (contact@lumiere.com)"}


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _resolve_article(
    title: str, year: int | None, content_type: str = "MOVIE"
) -> str | None:
    """Find the article via opensearch, preferring the right content type.

    Movies resolve against "... film" pages; TV shows against "... (TV series)"
    pages. Without this, shows resolved to nothing (or a same-name film) and
    never received pageview signals."""
    title_lower = title.lower()
    if content_type == "TV_SHOW":
        queries = [
            f"{title} (TV series)",
            f"{title} TV series",
            f"{title} {year} TV series" if year else None,
            title,
        ]
        accept = ("tv series", "tv mini", "web series", "tv programme", "talk show")
    else:
        queries = [
            f"{title} {year} film" if year else f"{title} film",
            f"{title} film",
            title,
        ]
        accept = ("film",)
    for q in queries:
        if not q:
            continue
        try:
            r = httpx.get(
                _WIKI_API,
                params={
                    "action": "opensearch",
                    "search": q,
                    "limit": 5,
                    "namespace": 0,
                    "format": "json",
                },
                headers=_headers(),
                timeout=15,
            )
            r.raise_for_status()
            results = r.json()
            candidates = results[1] if results and len(results) > 1 else []
            if not candidates:
                continue
            # Prefer an article that looks like the right content page over a
            # disambiguation or an unrelated same-name page.
            for candidate in candidates:
                low = candidate.lower()
                if (
                    any(a in low for a in accept)
                    or (year is not None and str(year) in low)
                    or title_lower in low
                ):
                    return candidate
            return candidates[0]
        except Exception:
            continue
    return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _fetch_daily_pageviews(article_title: str, days: int = _DAYS) -> list[dict]:
    """Fetch the daily pageview series for one article (last `days` days)."""
    title_formatted = article_title.strip().replace(" ", "_")
    end_date = datetime.now(timezone.utc) - timedelta(days=1)
    start_date = end_date - timedelta(days=days)
    start_str = start_date.strftime("%Y%m%d00")
    end_str = end_date.strftime("%Y%m%d00")
    url = _PAGEVIEWS_URL.format(article=title_formatted, start=start_str, end=end_str)
    r = httpx.get(url, headers=_headers(), timeout=20)
    if r.status_code == 404:
        return []
    r.raise_for_status()
    return r.json().get("items", [])


def fetch_wikipedia(film_tuples: list[tuple[int, str, int | None]]) -> list[RawMention]:
    """Given a list of (film_id, title, year), fetch daily Wikipedia pageviews."""
    out: list[RawMention] = []

    for tup in film_tuples:
        _, title, year = tup[:3]
        ct = tup[3] if len(tup) > 3 else "MOVIE"
        article = _resolve_article(title, year, ct)
        if not article:
            continue

        try:
            items = _fetch_daily_pageviews(article)
        except Exception:
            continue
        if not items:
            continue

        slug = article.replace(" ", "_")
        for item in items:
            views = int(item.get("views", 0) or 0)
            day = str(item.get("timestamp", ""))[:8]  # YYYYMMDD
            if views <= 0 or len(day) != 8:
                continue
            try:
                day_dt = datetime.strptime(day, "%Y%m%d").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            out.append(
                RawMention(
                    external_id=f"wiki_{slug}_{day}",
                    text=f"{title} Wikipedia article pageviews on {day}: {views} views.",
                    url=f"https://en.wikipedia.org/wiki/{slug}",
                    author="Wikipedia",
                    # `observations` is the real pageview count for that day;
                    # engagement mirrors it as the platform-weighted signal.
                    engagement=views,
                    observations=views,
                    created_at=day_dt,
                )
            )

    return out
