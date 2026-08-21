"""Wikipedia pageview ingestion adapter using Wikimedia REST API."""
from datetime import datetime, timedelta, timezone
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.ingest.base import RawMention


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _fetch_pageviews(article_title: str) -> dict | None:
    # Wikimedia requires article titles with underscores instead of spaces
    title_formatted = article_title.strip().replace(" ", "_")
    end_date = datetime.now(timezone.utc) - timedelta(days=1)
    start_date = end_date - timedelta(days=1)
    
    start_str = start_date.strftime("%Y%m%d00")
    end_str = end_date.strftime("%Y%m%d00")
    
    url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/{title_formatted}/daily/{start_str}/{end_str}"
    
    headers = {"User-Agent": settings.reddit_user_agent or "LumiereIndex/1.0 (contact@lumiere.com)"}
    r = httpx.get(url, headers=headers, timeout=15)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


def fetch_wikipedia(film_tuples: list[tuple[int, str, int | None]]) -> list[RawMention]:
    """Given list of (film_id, title, year), fetch Wikipedia pageviews as engagement signals."""
    out: list[RawMention] = []
    
    for _, title, year in film_tuples:
        # Try film title with _(film) or _(YYYY_film) fallback
        article_candidates = [
            f"{title} (film)",
            f"{title} ({year} film)" if year else f"{title} (film)",
            title,
        ]
        
        data = None
        used_article = title
        for candidate in article_candidates:
            try:
                res = _fetch_pageviews(candidate)
                if res and "items" in res and len(res["items"]) > 0:
                    data = res
                    used_article = candidate
                    break
            except Exception:
                continue
                
        if not data or "items" not in data:
            continue
            
        total_views = sum(item.get("views", 0) for item in data["items"])
        if total_views <= 0:
            continue
            
        ext_id = f"wiki_{used_article.replace(' ', '_')}_{datetime.now(timezone.utc).strftime('%Y%m%d')}"
        out.append(
            RawMention(
                external_id=ext_id,
                text=f"{title} Wikipedia article pageviews: {total_views} views.",
                url=f"https://en.wikipedia.org/wiki/{used_article.replace(' ', '_')}",
                author="Wikipedia",
                engagement=total_views,
                created_at=datetime.now(timezone.utc),
            )
        )
        
    return out
