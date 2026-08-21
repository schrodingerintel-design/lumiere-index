"""YouTube ingestion via RapidAPI (youtube-v3-alternative).

Strategy per film:
  1. Query "[film title] review" via /search endpoint
  2. Take top 5 video results
  3. Sum viewCount + likeCount + commentCount → YouTube Engagement Score
  4. Emit one RawMention per film with aggregated signal

Set in backend/.env:
  RAPIDAPI_KEY=<your key>
  RAPIDAPI_YOUTUBE_HOST=youtube-v3-alternative.p.rapidapi.com
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.ingest.base import RawMention

YT_BASE = "https://youtube-v3-alternative.p.rapidapi.com"
_TOP_N = 5  # number of videos to aggregate per film


def _rapidapi_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "x-rapidapi-host": settings.rapidapi_youtube_host,
        "x-rapidapi-key": settings.rapidapi_key,
    }


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _search(query: str) -> dict:
    r = httpx.get(
        f"{YT_BASE}/search",
        headers=_rapidapi_headers(),
        params={
            "query": query,
            "type": "video",
            "part": "id,snippet",
        },
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _video_stats(video_id: str) -> dict:
    """Fetch statistics (viewCount, likeCount, commentCount) for a single video."""
    r = httpx.get(
        f"{YT_BASE}/video",
        headers=_rapidapi_headers(),
        params={"id": video_id, "part": "statistics,snippet"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def _aggregate_engagement(video_ids: list[str]) -> tuple[int, str | None, str | None]:
    """
    Fetch stats for up to _TOP_N videos and sum engagement.
    Returns (total_engagement, top_video_url, top_video_publish_date).
    """
    total_views = 0
    total_likes = 0
    total_comments = 0
    top_url: str | None = None
    top_date: str | None = None

    for vid_id in video_ids[:_TOP_N]:
        try:
            data = _video_stats(vid_id)
        except Exception:
            continue

        # In standard YouTube API, details are in a list 'items' or 'item'.
        # In youtube-v3-alternative, details are directly at the root level of the response.
        items = data.get("items", data.get("item", []))
        if isinstance(items, list) and items:
            item = items[0]
            stats = item.get("statistics", {})
            snippet = item.get("snippet", {})
            pub_date = snippet.get("publishedAt") or item.get("publishDate") or item.get("uploadDate")
        else:
            # Check if root level contains the statistics
            item = data
            stats = data
            pub_date = data.get("publishDate") or data.get("uploadDate")

        total_views += int(stats.get("viewCount", 0) or 0)
        total_likes += int(stats.get("likeCount", 0) or 0)
        total_comments += int(stats.get("commentCount", 0) or 0)

        if top_url is None:
            top_url = f"https://youtube.com/watch?v={vid_id}"
            top_date = pub_date

    # Weighted score: likes/comments count more per unit than raw views
    engagement = total_likes * 3 + total_comments * 5 + total_views // 100
    return engagement, top_url, top_date


def _parse_date(iso_str: str | None) -> datetime:
    if not iso_str:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(iso_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return datetime.now(timezone.utc)


def fetch_youtube_for_film(
    film_id: int,
    title: str,
    year: Optional[int] = None,
) -> RawMention | None:
    """
    Query YouTube for '[title] review' and return a single aggregated RawMention.
    Returns None if no results are found or the API is not configured.
    """
    if not settings.rapidapi_key or not settings.rapidapi_youtube_host:
        return None

    query = f"{title} review"

    try:
        data = _search(query)
    except Exception:
        return None

    # youtube-v3-alternative returns search results under the 'data' key
    items = data.get("data", []) or data.get("items", [])
    if not items:
        return None

    video_ids: list[str] = []
    for it in items:
        # Check for both direct videoId field and nested id.videoId
        vid_id = it.get("videoId")
        if not vid_id and isinstance(it.get("id"), dict):
            vid_id = it["id"].get("videoId")
        if vid_id:
            video_ids.append(vid_id)

    if not video_ids:
        return None

    engagement, top_url, top_date = _aggregate_engagement(video_ids)

    # Construct text so FilmMatcher can verify the match
    year_str = f"({year})" if year else ""
    text = (
        f"{title} {year_str} film review — YouTube aggregated engagement score "
        f"from top {min(_TOP_N, len(video_ids))} videos. "
        f"Total views, likes, and comments combined."
    )

    return RawMention(
        external_id=f"youtube_film_{film_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H')}",
        text=text,
        url=top_url,
        author="youtube_aggregate",
        language="en",
        engagement=engagement,
        created_at=_parse_date(top_date),
    )


def fetch_youtube(film_titles: list[tuple[int, str, Optional[int]]]) -> list[RawMention]:
    """
    Main entry point.
    Accepts a list of (film_id, title, year) tuples from the database,
    queries each one on YouTube, and returns aggregated RawMentions.
    """
    if not settings.rapidapi_key or not settings.rapidapi_youtube_host:
        return []

    out: list[RawMention] = []
    for film_id, title, year in film_titles:
        mention = fetch_youtube_for_film(film_id, title, year)
        if mention:
            out.append(mention)
    return out
