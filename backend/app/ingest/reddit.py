from datetime import datetime, timezone
import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.ingest.base import RawMention

log = structlog.get_logger()

SUBS = ["movies", "TrueFilm", "flicks"]


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _fetch(sub: str, limit: int = 100) -> dict:
    url = f"https://www.reddit.com/r/{sub}/new.json?limit={limit}"
    r = httpx.get(url, headers={"User-Agent": settings.reddit_user_agent}, timeout=20)
    r.raise_for_status()
    return r.json()


def fetch_reddit() -> list[RawMention]:
    out: list[RawMention] = []
    for sub in SUBS:
        try:
            data = _fetch(sub)
        except Exception as e:
            log.warning("reddit.fetch.failed", subreddit=sub, error=str(e))
            continue
        for child in data.get("data", {}).get("children", []):
            d = child.get("data", {})
            text = f"{d.get('title', '')} {d.get('selftext', '')}".strip()
            if not text:
                continue
            out.append(RawMention(
                external_id=f"reddit_{d.get('id')}",
                text=text,
                url=f"https://reddit.com{d.get('permalink', '')}",
                author=d.get("author"),
                language="en",
                engagement=int(d.get("score", 0)) + int(d.get("num_comments", 0)),
                created_at=datetime.fromtimestamp(d.get("created_utc", 0), tz=timezone.utc),
            ))
    return out
