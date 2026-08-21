"""TikTok ingestion via RapidAPI (tiktok-api28).

Strategy per film:
  1. Query movie title via /video/search-videos endpoint
  2. Take top 5 video results
  3. Sum play_count + digg_count + comment_count → TikTok Engagement Score
  4. Emit one RawMention per film with aggregated signal

Set in backend/.env:
  RAPIDAPI_KEY=<your key>
  RAPIDAPI_TIKTOK_HOST=tiktok-api28.p.rapidapi.com

Returns empty list when the API is unreachable or unconfigured.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.ingest.base import RawMention

TT_BASE = "https://tiktok-api28.p.rapidapi.com"
_TOP_N = 5  # videos to aggregate per film


# ── API helpers ──────────────────────────────────────────────────────────────

def _rapidapi_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "x-rapidapi-host": settings.rapidapi_tiktok_host,
        "x-rapidapi-key": settings.rapidapi_key,
    }


@retry(stop=stop_after_attempt(1), wait=wait_exponential(multiplier=1, min=2, max=5))
def _search_videos(keyword: str, cursor: int = 0) -> dict:
    r = httpx.get(
        f"{TT_BASE}/video/search-videos",
        headers=_rapidapi_headers(),
        params={"keyword": keyword, "cursor": str(cursor)},
        timeout=30,  # Fail fast — unofficial scrapers can be slow
    )
    r.raise_for_status()
    return r.json()


def _extract_videos(data: dict) -> list[dict]:
    """Pull the video list from whichever key the API uses."""
    for key in ["data", "videos", "aweme_list", "itemList", "items"]:
        val = data.get(key)
        if isinstance(val, list) and val:
            return val
    # Sometimes nested under data.videos
    inner = data.get("data")
    if isinstance(inner, dict):
        for key in ["videos", "aweme_list", "items"]:
            val = inner.get(key)
            if isinstance(val, list) and val:
                return val
    return []


def _get_stats(video: dict) -> tuple[int, int, int]:
    """Extract play_count, digg_count (likes), comment_count from a video object."""
    stats = video.get("stats") or video.get("statistics") or video
    play = int(stats.get("play_count", 0) or stats.get("playCount", 0) or 0)
    digg = int(stats.get("digg_count", 0) or stats.get("diggCount", 0) or 0)
    comments = int(stats.get("comment_count", 0) or stats.get("commentCount", 0) or 0)
    return play, digg, comments


# ── per-film live fetcher ────────────────────────────────────────────────────

def fetch_tiktok_for_film(
    film_id: int,
    title: str,
    year: Optional[int] = None,
) -> RawMention | None:
    """
    Search TikTok for '[title]' and return a single aggregated RawMention.
    Returns None if no results or API is not configured.
    """
    if not settings.rapidapi_key or not settings.rapidapi_tiktok_host:
        return None

    try:
        data = _search_videos(title)
    except Exception:
        return None

    videos = _extract_videos(data)
    if not videos:
        return None

    total_plays = 0
    total_likes = 0
    total_comments = 0
    top_desc = ""

    for vid in videos[:_TOP_N]:
        plays, likes, comments = _get_stats(vid)
        total_plays += plays
        total_likes += likes
        total_comments += comments
        if not top_desc:
            top_desc = vid.get("desc", "") or vid.get("title", "") or ""

    engagement = total_likes * 2 + total_comments * 4 + total_plays // 200

    year_str = f"({year})" if year else ""
    text = (
        f"{title} {year_str} film — TikTok aggregated audience signal "
        f"from top {min(_TOP_N, len(videos))} videos. "
        f"{top_desc[:200]}"
    )

    return RawMention(
        external_id=f"tiktok_film_{film_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H')}",
        text=text,
        url=None,
        author="tiktok_aggregate",
        language="en",
        engagement=engagement,
        created_at=datetime.now(timezone.utc),
    )


# ── fallback (returns empty list so UI shows honest empty state) ────────────

def _fallback_fetch(film_titles: list[tuple[int, str, Optional[int]]]) -> list[RawMention]:
    return []


# ── public API ───────────────────────────────────────────────────────────────

def fetch_tiktok(film_titles: list[tuple[int, str, Optional[int]]]) -> list[RawMention]:
    """
    Main entry point. Accepts (film_id, title, year) tuples.
    Tries the live RapidAPI scraper per-film; returns empty list if unavailable.
    """
    if not settings.rapidapi_key or not settings.rapidapi_tiktok_host:
        return []

    out: list[RawMention] = []

    for film_id, title, year in film_titles:
        mention = fetch_tiktok_for_film(film_id, title, year)
        if mention:
            out.append(mention)

    return out
