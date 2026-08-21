"""Rate limiting middleware for FastAPI."""
import time
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from app.utils.cache import get_redis

# Maximum IPs to track in memory before forced eviction
_MAX_MEMORY_ENTRIES = 10_000


class SimpleRateLimiterMiddleware(BaseHTTPMiddleware):
    _instances: set["SimpleRateLimiterMiddleware"] = set()

    def __init__(self, app, requests_per_minute: int = 120):
        super().__init__(app)
        self.rpm = requests_per_minute
        self.memory_store: dict[str, list[float]] = {}
        self._last_cleanup = 0.0
        self._instances.add(self)

    @classmethod
    def reset_all(cls) -> None:
        """Clear in-memory counters (used by tests for isolation)."""
        for inst in cls._instances:
            inst.memory_store.clear()
            inst._last_cleanup = 0.0

    def _cleanup_memory_store(self, now: float) -> None:
        """Evict stale entries and cap total entries."""
        cutoff = now - 120.0
        stale = [ip for ip, ts in self.memory_store.items() if not ts or ts[-1] < cutoff]
        for ip in stale:
            del self.memory_store[ip]

        # If still over limit, remove oldest entries
        if len(self.memory_store) > _MAX_MEMORY_ENTRIES:
            sorted_ips = sorted(
                self.memory_store.keys(),
                key=lambda ip: self.memory_store[ip][-1] if self.memory_store[ip] else 0,
            )
            to_remove = len(self.memory_store) - _MAX_MEMORY_ENTRIES
            for ip in sorted_ips[:to_remove]:
                del self.memory_store[ip]

    async def dispatch(self, request: Request, call_next):
        if request.url.path in ["/health", "/docs", "/openapi.json"]:
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        window_start = now - 60.0

        # Periodic cleanup every 60s
        if now - self._last_cleanup > 60.0:
            self._last_cleanup = now
            self._cleanup_memory_store(now)

        redis = get_redis()
        if redis:
            key = f"ratelimit:{client_ip}"
            try:
                pipe = redis.pipeline()
                pipe.zremrangebyscore(key, 0, window_start)
                pipe.zadd(key, {str(now): now})
                pipe.zcard(key)
                pipe.expire(key, 60)
                _, _, req_count, _ = pipe.execute()

                if req_count > self.rpm:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Rate limit exceeded. Please try again later.",
                    )
            except HTTPException:
                raise
            except Exception:
                pass
        else:
            timestamps = self.memory_store.get(client_ip, [])
            timestamps = [t for t in timestamps if t > window_start]
            timestamps.append(now)
            self.memory_store[client_ip] = timestamps

            if len(timestamps) > self.rpm:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Please try again later.",
                )

        return await call_next(request)
