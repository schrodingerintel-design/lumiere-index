"""Endpoint caching decorator — Redis-backed with an in-process fallback."""
import functools
import json
import logging
import threading
import time
from typing import Any, Callable
from fastapi import Request, Response
from redis import Redis

from app.config import settings

log = logging.getLogger(__name__)

# Process-local TTL cache used when Redis is unavailable (e.g. local dev without
# a redis container). Keeps the same TTL semantics so behavior is identical
# whether or not Redis is running.
_MEM_CACHE: dict[str, tuple[float, Any]] = {}
_MEM_LOCK = threading.Lock()

_redis_client: Redis | None = None
_redis_checked: bool = False


def get_redis() -> Redis | None:
    """Return the shared Redis client, or None when Redis is unavailable.

    The result is cached permanently (including failures) so requests never
    block on a dead Redis — without this, every request retried the connect
    timeout and added seconds of latency to the whole API.
    """
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    try:
        url = settings.redis_url
        if settings.redis_password and "://" in url:
            protocol, rest = url.split("://", 1)
            url = f"{protocol}://:{settings.redis_password}@{rest}"
        client = Redis.from_url(url, decode_responses=True, socket_timeout=1)
        client.ping()
        _redis_client = client
        log.info("cache: redis connected (%s)", url.split("@")[-1])
    except Exception as exc:
        # Log once so a missing Redis is loud in dev, not a silent no-op.
        log.warning("cache: redis unavailable (%s) — falling back to in-process cache", exc)
        _redis_client = None
    return _redis_client


def invalidate_cache(pattern: str = "cache:*") -> int:
    """Remove all cache keys matching a pattern. Returns number of keys deleted."""
    redis = get_redis()
    if not redis:
        return 0
    try:
        keys = list(redis.scan_iter(match=pattern, count=500))
        if keys:
            return redis.delete(*keys)
    except Exception:
        pass
    return 0


def _serialize_item(item) -> dict | list | str | int | float | bool | None:
    """Safely serialize a single item to JSON-compatible data."""
    if hasattr(item, "model_dump"):
        return item.model_dump(mode="json")
    if isinstance(item, dict):
        return {k: _serialize_item(v) for k, v in item.items()}
    if isinstance(item, (list, tuple)):
        return [_serialize_item(i) for i in item]
    return item


def _serialize(res) -> Any:
    """Turn a FastAPI return value into JSON-compatible data for caching."""
    if hasattr(res, "model_dump"):
        return res.model_dump(mode="json")
    if isinstance(res, list):
        return [_serialize_item(item) for item in res]
    return res


def cache_response(expire_seconds: int = 60):
    """Cache FastAPI endpoint responses, preferring Redis with an in-process fallback."""
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            request: Request | None = kwargs.get("request") or next(
                (a for a in args if isinstance(a, Request)), None
            )
            if not request:
                return func(*args, **kwargs)

            cache_key = f"cache:{request.url.path}:{request.query_params}"
            redis = get_redis()

            # ── Read path ────────────────────────────────────────────────────
            if redis:
                try:
                    cached = redis.get(cache_key)
                    if cached:
                        return json.loads(cached)
                except Exception:
                    pass
            else:
                now = time.monotonic()
                with _MEM_LOCK:
                    hit = _MEM_CACHE.get(cache_key)
                if hit and now - hit[0] < expire_seconds:
                    return hit[1]

            res = func(*args, **kwargs)

            # ── Write path ───────────────────────────────────────────────────
            try:
                data = _serialize(res)
                if redis:
                    redis.setex(cache_key, expire_seconds, json.dumps(data, default=str))
                else:
                    with _MEM_LOCK:
                        _MEM_CACHE[cache_key] = (time.monotonic(), data)
            except Exception:
                pass

            return res
        return wrapper
    return decorator
