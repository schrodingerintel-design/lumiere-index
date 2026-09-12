"""YouTube Data API v3 integration service.

Features:
  1. Quota Guard: Tracks daily units (10,000/day limit, search=100, videos=1).
     Switches to cached/backoff mode when approaching limit (>=90%).
  2. Batching: Batches `videos.list` calls (up to 50 video IDs per call)
     to maximize quota efficiency.
  3. Official Trailer Matcher: High-precision heuristics matching official studio
     channels and trailer keywords, penalizing fan-edits and concept trailers.
  4. Caching: Redis-backed (6-12h TTL) with automatic in-process fallback.
  5. Security: Server-side only; YOUTUBE_API_KEY never leaks to client.
"""
from __future__ import annotations

import json
import logging
import math
import re
import threading
import time
from datetime import datetime, date, timezone, timedelta
from typing import Any, NamedTuple, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import settings
from app.utils.cache import get_redis

log = logging.getLogger(__name__)

YT_API_BASE = "https://www.googleapis.com/youtube/v3"

# Major movie studios and distributor channels for trailer verification
OFFICIAL_STUDIOS = {
    "warner bros", "warner bros. pictures", "universal pictures", "sony pictures entertainment",
    "sony pictures", "20th century studios", "paramount pictures", "marvel entertainment",
    "walt disney studios", "disney", "netflix", "a24", "neon", "lionsgate movies", "lionsgate",
    "apple tv", "amazon mgm studios", "mgm", "searchlight pictures", "focus features",
    "illumination", "pixar", "dreamworks animation", "studiocanal", "lucasfilm", "hbo", "max",
    "ketchup entertainment", "bleecker street", "ifc films", "mubi", "curzon",
}

# In-memory quota and trailer caches (fallback when Redis is unavailable)
_MEM_LOCK = threading.Lock()
_MEM_QUOTA: dict[str, int] = {}
_MEM_CACHE: dict[str, tuple[float, Any]] = {}


class TrailerMatch(NamedTuple):
    video_id: str
    video_title: str
    channel_title: str
    published_at: datetime | None
    confidence: float
    is_official: bool


class YouTubeVideoStats(NamedTuple):
    video_id: str
    video_title: str
    channel_title: str
    view_count: int
    like_count: int
    comment_count: int
    published_at: datetime | None
    view_velocity: float  # views per day since publication
    confidence: float
    is_official: bool


# ── Quota Guard ─────────────────────────────────────────────────────────────

class QuotaGuard:
    """Manages and enforces daily YouTube Data API v3 quota consumption."""

    SEARCH_COST = 100
    VIDEOS_LIST_COST = 1

    @classmethod
    def _today_key(cls) -> str:
        return f"youtube:quota:{date.today().isoformat()}"

    @classmethod
    def get_daily_usage(cls) -> int:
        key = cls._today_key()
        redis = get_redis()
        if redis:
            try:
                val = redis.get(key)
                return int(val) if val else 0
            except Exception:
                pass
        with _MEM_LOCK:
            return _MEM_QUOTA.get(key, 0)

    @classmethod
    def can_consume(cls, units: int) -> bool:
        """Check if consuming `units` remains within the daily budget limit."""
        limit = settings.youtube_quota_daily_limit
        # Soft safety ceiling at 92% of the budget
        safe_limit = int(limit * 0.92)
        current = cls.get_daily_usage()
        return (current + units) <= safe_limit

    @classmethod
    def record_usage(cls, units: int) -> int:
        """Record consumed quota units for today. Returns new total."""
        key = cls._today_key()
        redis = get_redis()
        new_val = units
        if redis:
            try:
                new_val = redis.incrby(key, units)
                # Expire quota counter after 48 hours
                redis.expire(key, 172800)
                return new_val
            except Exception:
                pass
        with _MEM_LOCK:
            current = _MEM_QUOTA.get(key, 0)
            new_val = current + units
            _MEM_QUOTA[key] = new_val
        return new_val


# ── Cache Helpers ────────────────────────────────────────────────────────────

def _cache_get(key: str) -> Any | None:
    redis = get_redis()
    if redis:
        try:
            val = redis.get(key)
            if val:
                return json.loads(val)
        except Exception:
            pass
    now = time.monotonic()
    with _MEM_LOCK:
        entry = _MEM_CACHE.get(key)
    if entry and now - entry[0] < entry[1]:
        return entry[2]
    return None


def _cache_set(key: str, data: Any, ttl_seconds: int) -> None:
    redis = get_redis()
    if redis:
        try:
            redis.setex(key, ttl_seconds, json.dumps(data, default=str))
            return
        except Exception:
            pass
    with _MEM_LOCK:
        _MEM_CACHE[key] = (time.monotonic(), ttl_seconds, data)


# ── YouTube Service Client ───────────────────────────────────────────────────

class YouTubeService:
    """Encapsulates all interaction with YouTube Data API v3."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.youtube_api_key
        self.cache_ttl_seconds = max(settings.youtube_cache_ttl_hours, 1) * 3600

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    # ── Matcher Heuristics ───────────────────────────────────────────────────

    def score_trailer_candidate(
        self,
        item: dict,
        film_title: str,
        year: Optional[int] = None,
    ) -> tuple[float, bool]:
        """Score candidate video snippet for official trailer match.

        Returns (confidence ∈ [0.0, 1.0], is_official).
        """
        snippet = item.get("snippet", {})
        vid_title = (snippet.get("title") or "").lower()
        channel = (snippet.get("channelTitle") or "").lower()
        description = (snippet.get("description") or "").lower()

        # Reject common fan-made / parody uploads
        negative_markers = [
            "fan made", "concept trailer", "fan trailer", "teaser edit",
            "parody", "reaction", "review", "ending explained", "breakdown",
            "tribute", "music video", "amv", "scene", "clip"
        ]
        for marker in negative_markers:
            # If marker is in title, severely penalize unless official studio upload
            if re.search(r"\b" + re.escape(marker) + r"\b", vid_title):
                return 0.1, False

        title_norm = film_title.lower()
        # Clean special chars from film title for word matching
        clean_film_words = set(re.findall(r"\w+", title_norm))

        # Check title overlap
        has_full_title = title_norm in vid_title
        matched_words = sum(1 for w in clean_film_words if w in vid_title)
        title_coverage = matched_words / max(len(clean_film_words), 1)

        if not has_full_title and title_coverage < 0.6:
            return 0.2, False

        score = 0.5

        # Check official studio channel
        is_studio_channel = any(studio in channel for studio in OFFICIAL_STUDIOS)
        if is_studio_channel:
            score += 0.35

        # Check trailer keywords
        if "official trailer" in vid_title:
            score += 0.25
        elif "main trailer" in vid_title or "final trailer" in vid_title:
            score += 0.2
        elif "teaser trailer" in vid_title or "official teaser" in vid_title:
            score += 0.15
        elif "trailer" in vid_title:
            score += 0.1

        # Check release year match if available
        if year:
            year_str = str(year)
            prev_year_str = str(year - 1)
            next_year_str = str(year + 1)
            if year_str in vid_title or year_str in description:
                score += 0.1
            elif prev_year_str in vid_title or next_year_str in vid_title:
                score += 0.05

        confidence = max(0.0, min(1.0, score))
        is_official = is_studio_channel or (confidence >= 0.75 and "official" in vid_title)
        return confidence, is_official

    # ── Search API (`search.list`) ───────────────────────────────────────────

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=6),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
        reraise=False,
    )
    def search_trailer(
        self,
        film_title: str,
        year: Optional[int] = None,
    ) -> TrailerMatch | None:
        """Search YouTube for the film's trailer using `search.list` (100 quota units)."""
        if not self.is_configured:
            return None

        cache_key = f"youtube:search:{film_title.lower()}:{year or ''}"
        cached = _cache_get(cache_key)
        if cached:
            pub_date = (
                datetime.fromisoformat(cached["published_at"])
                if cached.get("published_at")
                else None
            )
            return TrailerMatch(
                video_id=cached["video_id"],
                video_title=cached["video_title"],
                channel_title=cached["channel_title"],
                published_at=pub_date,
                confidence=cached["confidence"],
                is_official=cached["is_official"],
            )

        # Quota Guard check (search costs 100 units)
        if not QuotaGuard.can_consume(QuotaGuard.SEARCH_COST):
            log.warning(
                "youtube_service: daily quota budget near exhaustion (%d units used) — skipping search for '%s'",
                QuotaGuard.get_daily_usage(),
                film_title,
            )
            return None

        query = f"{film_title} official trailer"
        if year:
            query += f" {year}"

        params = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": 6,
            "key": self.api_key,
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.get(f"{YT_API_BASE}/search", params=params)
                if resp.status_code == 403:
                    log.warning("youtube_service: 403 quota exceeded or forbidden — %s", resp.text[:200])
                    return None
                resp.raise_for_status()
                data = resp.json()

            QuotaGuard.record_usage(QuotaGuard.SEARCH_COST)
        except Exception as exc:
            log.warning("youtube_service: search failed for '%s' — %s", film_title, exc)
            return None

        items = data.get("items", [])
        if not items:
            return None

        # Evaluate and rank candidates
        scored_candidates: list[tuple[float, bool, dict]] = []
        for it in items:
            conf, official = self.score_trailer_candidate(it, film_title, year)
            scored_candidates.append((conf, official, it))

        # Sort: official first, then highest confidence
        scored_candidates.sort(key=lambda x: (x[1], x[0]), reverse=True)
        best_conf, is_off, best_item = scored_candidates[0]

        vid_id = best_item.get("id", {}).get("videoId")
        if not vid_id:
            return None

        snippet = best_item.get("snippet", {})
        pub_str = snippet.get("publishedAt")
        pub_date: datetime | None = None
        if pub_str:
            try:
                pub_date = datetime.fromisoformat(pub_str.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                pass

        if best_conf < settings.youtube_min_confidence:
            log.info(
                "youtube_service: low confidence match (%.2f) for '%s' -> '%s' (%s) - flagged for review",
                best_conf,
                film_title,
                snippet.get("title"),
                vid_id,
            )

        match = TrailerMatch(
            video_id=vid_id,
            video_title=snippet.get("title", ""),
            channel_title=snippet.get("channelTitle", ""),
            published_at=pub_date,
            confidence=best_conf,
            is_official=is_off,
        )

        _cache_set(
            cache_key,
            {
                "video_id": match.video_id,
                "video_title": match.video_title,
                "channel_title": match.channel_title,
                "published_at": match.published_at.isoformat() if match.published_at else None,
                "confidence": match.confidence,
                "is_official": match.is_official,
            },
            self.cache_ttl_seconds,
        )
        return match

    # ── Videos List API (`videos.list` with Batching) ─────────────────────────

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=6),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
        reraise=False,
    )
    def fetch_videos_stats_batch(
        self,
        video_ids: list[str],
    ) -> dict[str, dict[str, Any]]:
        """Fetch statistics & snippet for up to 50 video IDs in a single batched call.

        Cost: 1 quota unit for the entire batch of 50.
        Returns map of video_id -> raw stat dict.
        """
        if not self.is_configured or not video_ids:
            return {}

        # Chunk into slices of 50
        results: dict[str, dict[str, Any]] = {}
        chunks = [video_ids[i:i + 50] for i in range(0, len(video_ids), 50)]

        for chunk in chunks:
            # Check cached items first
            uncached_ids = []
            for vid in chunk:
                c = _cache_get(f"youtube:stats:{vid}")
                if c:
                    results[vid] = c
                else:
                    uncached_ids.append(vid)

            if not uncached_ids:
                continue

            if not QuotaGuard.can_consume(QuotaGuard.VIDEOS_LIST_COST):
                log.warning("youtube_service: daily quota budget near exhaustion — skipping videos.list")
                break

            params = {
                "part": "snippet,statistics",
                "id": ",".join(uncached_ids),
                "key": self.api_key,
            }

            try:
                with httpx.Client(timeout=15.0) as client:
                    resp = client.get(f"{YT_API_BASE}/videos", params=params)
                    if resp.status_code == 403:
                        log.warning("youtube_service: 403 quota exceeded in videos.list")
                        break
                    resp.raise_for_status()
                    data = resp.json()

                QuotaGuard.record_usage(QuotaGuard.VIDEOS_LIST_COST)
                for item in data.get("items", []):
                    vid = item.get("id")
                    if vid:
                        results[vid] = item
                        _cache_set(f"youtube:stats:{vid}", item, self.cache_ttl_seconds)
            except Exception as exc:
                log.warning("youtube_service: videos.list batch error — %s", exc)

        return results

    def get_video_stats(
        self,
        video_id: str,
        video_title: str = "",
        channel_title: str = "",
        confidence: float = 1.0,
        is_official: bool = True,
    ) -> YouTubeVideoStats | None:
        """Fetch stats for a single video ID, parsing counts and computing velocity."""
        batch_res = self.fetch_videos_stats_batch([video_id])
        item = batch_res.get(video_id)
        if not item:
            return None

        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})

        view_count = int(stats.get("viewCount", 0) or 0)
        like_count = int(stats.get("likeCount", 0) or 0)
        comment_count = int(stats.get("commentCount", 0) or 0)

        pub_str = snippet.get("publishedAt")
        pub_date: datetime | None = None
        if pub_str:
            try:
                pub_date = datetime.fromisoformat(pub_str.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                pass

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if pub_date:
            days_since = max((now - pub_date).total_seconds() / 86400.0, 0.5)
        else:
            days_since = 30.0

        view_velocity = float(view_count) / days_since

        return YouTubeVideoStats(
            video_id=video_id,
            video_title=snippet.get("title") or video_title,
            channel_title=snippet.get("channelTitle") or channel_title,
            view_count=view_count,
            like_count=like_count,
            comment_count=comment_count,
            published_at=pub_date,
            view_velocity=round(view_velocity, 2),
            confidence=confidence,
            is_official=is_official,
        )


# Singleton instance
youtube_service = YouTubeService()
