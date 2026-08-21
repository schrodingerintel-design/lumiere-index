"""Backend proxy for TMDB API calls — keeps the API key server-side only."""

import asyncio
import logging
import random
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query
import httpx

from app.config import settings

log = logging.getLogger(__name__)

router = APIRouter()

TMDB_BASE = "https://api.themoviedb.org/3"

# In-memory TTL cache for calendar-style lists so repeat page loads don't hit
# the slow upstream TMDB connection again. (Redis is optional in this app.)
_TTL_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL_SECONDS = 30 * 60

# Transient upstream failures worth retrying: rate limits (429), gateway 5xx,
# and transport errors (DNS/connect failures, timeouts, dropped connections).
_RETRY_STATUS = {429, 502, 503, 504}
_MAX_ATTEMPTS = 4
_BASE_DELAY = 0.4


async def _cached_get(path: str, params: dict[str, str] | None = None, ttl: int = _CACHE_TTL_SECONDS):
    key = f"{path}?{params}" if params else path
    hit = _TTL_CACHE.get(key)
    if hit and time.monotonic() - hit[0] < ttl:
        return hit[1]
    data = await _proxy_get(path, params)
    _TTL_CACHE[key] = (time.monotonic(), data)
    return data


def _get_key() -> str:
    if not settings.tmdb_api_key:
        raise HTTPException(503, "TMDB API key not configured on server")
    return settings.tmdb_api_key


def _retry_delay(attempt: int, retry_after: str | None = None) -> float:
    """Exponential backoff with jitter, honoring TMDB's Retry-After when present."""
    if retry_after and retry_after.isdigit():
        return min(float(retry_after), 5.0) + random.uniform(0, 0.25)
    return min(_BASE_DELAY * (2 ** (attempt - 1)), 5.0) + random.uniform(0, 0.25)


async def _proxy_get(path: str, params: dict[str, str] | None = None):
    """Call TMDB with retry-with-backoff for transient failures.

    DNS/connect failures, timeouts, rate limits (429), and gateway 5xx errors
    are retried up to _MAX_ATTEMPTS times; a final failure surfaces as a clean
    503 with a friendly message instead of an unhandled 500.
    """
    p = {"api_key": _get_key()}
    if params:
        p.update(params)

    last_error: Exception | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.get(f"{TMDB_BASE}{path}", params=p)

            if res.status_code == 200:
                return res.json()

            # Non-transient upstream error (bad key, unknown movie, etc.) —
            # surface it immediately with TMDB's own status.
            if res.status_code not in _RETRY_STATUS:
                raise HTTPException(res.status_code, f"TMDB error: {res.text[:300]}")

            if attempt < _MAX_ATTEMPTS:
                delay = _retry_delay(attempt, res.headers.get("retry-after"))
                log.warning(
                    "tmdb_proxy: %s%s -> %s (attempt %d/%d), retrying in %.2fs",
                    path, p, res.status_code, attempt, _MAX_ATTEMPTS, delay,
                )
                await asyncio.sleep(delay)
                continue

            # Exhausted retries on a transient status — fall through to 503.
            last_error = httpx.HTTPStatusError(
                f"TMDB returned {res.status_code} after {_MAX_ATTEMPTS} attempts",
                request=res.request,
                response=res,
            )
            break

        except httpx.TransportError as exc:
            # Covers DNS failures (getaddrinfo), connection refused, timeouts,
            # and dropped connections — exactly what caused the earlier 500s.
            last_error = exc
            if attempt < _MAX_ATTEMPTS:
                delay = _retry_delay(attempt)
                log.warning(
                    "tmdb_proxy: %s%s transport error (%s), attempt %d/%d, retrying in %.2fs",
                    path, p, type(exc).__name__, attempt, _MAX_ATTEMPTS, delay,
                )
                await asyncio.sleep(delay)
                continue
            break

    raise HTTPException(
        503,
        "Upstream film data service is temporarily unavailable — please try again shortly.",
    ) from last_error


@router.get("/tmdb/search/movie")
async def search_movie(
    query: str = Query(...),
    year: int | None = Query(None),
):
    params: dict[str, str] = {"query": query}
    if year:
        params["year"] = str(year)
    return await _proxy_get("/search/movie", params)


@router.get("/tmdb/movie/upcoming")
async def movie_upcoming(page: int = Query(1)):
    return await _cached_get("/movie/upcoming", {"page": str(page)})


@router.get("/tmdb/movie/now_playing")
async def movie_now_playing(page: int = Query(1)):
    return await _cached_get("/movie/now_playing", {"page": str(page)})


@router.get("/tmdb/movie/{tmdb_id}/videos")
async def movie_videos(tmdb_id: int):
    return await _proxy_get(f"/movie/{tmdb_id}/videos")


@router.get("/tmdb/movie/{tmdb_id}")
async def movie_details(tmdb_id: int):
    return await _proxy_get(f"/movie/{tmdb_id}", {"append_to_response": "release_dates,keywords"})


@router.get("/tmdb/movie/{tmdb_id}/watch/providers")
async def movie_watch_providers(tmdb_id: int):
    """Streaming / rent / buy availability for a movie, keyed by country code."""
    return await _proxy_get(f"/movie/{tmdb_id}/watch/providers")


@router.get("/tmdb/discover/movie")
async def discover_movie(
    with_genres: str | None = Query(None),
    with_original_language: str | None = Query(None),
    sort_by: str = Query("popularity.desc"),
    page: int = Query(1),
):
    params: dict[str, str] = {"sort_by": sort_by, "page": str(page)}
    if with_genres:
        params["with_genres"] = with_genres
    if with_original_language:
        params["with_original_language"] = with_original_language
    return await _cached_get("/discover/movie", params)


@router.get("/tmdb/discover/tv")
async def discover_tv(
    sort_by: str = Query("popularity.desc"),
    page: int = Query(1),
):
    return await _cached_get("/discover/tv", {"sort_by": sort_by, "page": str(page)})
