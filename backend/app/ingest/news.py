from datetime import datetime, timezone
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.ingest.base import RawMention


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _fetch(q: str) -> dict:
    r = httpx.get(
        "https://newsapi.org/v2/everything",
        params={"q": q, "language": "en", "sortBy": "publishedAt", "pageSize": 100},
        headers={"X-Api-Key": settings.newsapi_key},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def fetch_news(query: str = "film OR movie OR cinema") -> list[RawMention]:
    if not settings.newsapi_key:
        return []
    try:
        data = _fetch(query)
    except Exception:
        return []
    out: list[RawMention] = []
    for a in data.get("articles", []):
        text = f"{a.get('title', '')} {a.get('description', '') or ''}".strip()
        if not text:
            continue
        published = a.get("publishedAt")
        try:
            created = datetime.fromisoformat(published.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            created = datetime.now(timezone.utc)
        out.append(RawMention(
            external_id=f"news_{a.get('url')}",
            text=text,
            url=a.get("url"),
            author=(a.get("source") or {}).get("name"),
            language="en",
            engagement=0,
            created_at=created,
        ))
    return out
