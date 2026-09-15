"""Backend proxy for TMDB API calls — keeps the API key server-side only."""

import asyncio
import logging
import random
import re
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
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


@router.get("/tmdb/search/tv")
async def search_tv(
    query: str = Query(...),
    first_air_date_year: int | None = Query(None, alias="year"),
):
    """Search TV shows — TV is first-class catalog content, not a movie variant."""
    params: dict[str, str] = {"query": query}
    if first_air_date_year:
        params["first_air_date_year"] = str(first_air_date_year)
    return await _proxy_get("/search/tv", params)


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
    with_genres: str | None = Query(None),
    sort_by: str = Query("popularity.desc"),
    page: int = Query(1),
):
    params: dict[str, str] = {"sort_by": sort_by, "page": str(page)}
    if with_genres:
        params["with_genres"] = with_genres
    return await _cached_get("/discover/tv", params)


@router.get("/tmdb/tv/on_the_air")
async def tv_on_the_air(page: int = Query(1)):
    """Shows currently airing within the next 7 days."""
    return await _cached_get("/tv/on_the_air", {"page": str(page)})


@router.get("/tmdb/tv/airing_today")
async def tv_airing_today(page: int = Query(1)):
    return await _cached_get("/tv/airing_today", {"page": str(page)})


@router.get("/tmdb/tv/popular")
async def tv_popular(page: int = Query(1)):
    return await _cached_get("/tv/popular", {"page": str(page)})


@router.get("/tmdb/tv/top_rated")
async def tv_top_rated(page: int = Query(1)):
    return await _cached_get("/tv/top_rated", {"page": str(page)})


@router.get("/tmdb/tv/{tmdb_id}")
async def tv_details(tmdb_id: int):
    return await _proxy_get(f"/tv/{tmdb_id}", {"append_to_response": "keywords,content_ratings"})


# ── Image proxy ──────────────────────────────────────────────────────────────
# Poster bytes for share-card canvas rendering. Browsers key their image
# cache without CORS attributes, so a canvas `crossOrigin` fetch of the same
# TMDB URL can be served the non-CORS cache entry and the draw taints/fails.
# Proxying bytes through this API gives the canvas one reliable, cache-aware
# same-origin-style source (the API host the frontend already talks to).

_ALLOWED_IMAGE_SIZES = {"w92", "w154", "w185", "w300", "w342", "w500", "w780", "w1280", "original"}
_IMAGE_TTL_SECONDS = 30 * 60
_IMAGE_CACHE_MAX = 400
_image_cache: dict[str, tuple[float, bytes, str]] = {}
_IMAGE_NAME_RE = re.compile(r"[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)")


@router.get("/tmdb/image/{size}/{path:path}")
async def tmdb_image(size: str, path: str):
    """Serve a TMDB image at an allowlisted size, with a small TTL byte cache."""
    if size not in _ALLOWED_IMAGE_SIZES:
        raise HTTPException(400, "unsupported image size")

    name = path.strip("/").rsplit("/", 1)[-1]
    if not _IMAGE_NAME_RE.fullmatch(name):
        raise HTTPException(400, "invalid image path")

    key = f"{size}/{name}"
    now = time.monotonic()
    hit = _image_cache.get(key)
    if hit and now - hit[0] < _IMAGE_TTL_SECONDS:
        content, ctype = hit[1], hit[2]
    else:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.get(f"https://image.tmdb.org/t/p/{size}/{name}")
        except httpx.TransportError as exc:
            raise HTTPException(503, "image upstream unavailable") from exc
        if res.status_code != 200:
            raise HTTPException(res.status_code, "image not found upstream")
        content = res.content
        ctype = res.headers.get("content-type", "image/jpeg")
        if not ctype.startswith("image/"):
            raise HTTPException(502, "upstream did not return an image")
        if len(_image_cache) >= _IMAGE_CACHE_MAX:
            for stale in sorted(_image_cache, key=lambda k: _image_cache[k][0])[:50]:
                _image_cache.pop(stale, None)
        _image_cache[key] = (now, content, ctype)

    return Response(
        content=content,
        media_type=ctype,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/tmdb/tv/{tmdb_id}/videos")
async def tv_videos(tmdb_id: int):
    """Trailer/video keys for a show — same YouTube-id payload shape as movies."""
    return await _proxy_get(f"/tv/{tmdb_id}/videos")


@router.get("/tmdb/tv/{tmdb_id}/watch/providers")
async def tv_watch_providers(tmdb_id: int):
    """Streaming / rent / buy availability for a show, keyed by country code."""
    return await _proxy_get(f"/tv/{tmdb_id}/watch/providers")
