"""DB outage circuit breaker — fail fast while MySQL is unreachable.

Why this exists
═══════════════
During the 2026-09-20 MySQL outage, every API request walked the full TCP
timeout ladder (5s connect timeout on a dead host). With Railway's health
probes + the ingest scheduler + live traffic, that produced:
  - ~45-60s p95 latency for every request during an outage
  - a 500-logs/sec log flood (Railway dropped 1,722 messages)
  - every endpoint returning 500 after hanging

With the breaker:
  - The FIRST request to hit a dead DB pays the TCP timeout (~5s worst
    case, usually instant connection-refused).
  - Every subsequent request within ``RESET_SECONDS`` gets an instant,
    honest 503 without touching the network.
  - The breaker half-opens automatically after RESET_SECONDS: the next
    request acts as the probe — if MySQL answers, the breaker closes and
    traffic flows again; if not, one failure re-opens it.

This changes nothing about the happy path — every check is a cheap
monotonic-clock comparison. It only changes behavior while the DB is down,
which is exactly when the old behavior (each request paying the full
timeout, then 500) was worst.
"""

from __future__ import annotations

import logging
import threading
import time

log = logging.getLogger("app.db_health")

# How long after the last confirmed failure the breaker stays open. When it
# lapses, the next request becomes the probe (it pays the real timeout once)
# and either confirms the outage or resets the breaker on success.
RESET_SECONDS = 30.0

_open_since: float | None = None
_lock = threading.Lock()


def record_failure(reason: str) -> None:
    """Record a failed DB touch — opens (or keeps open) the breaker."""
    global _open_since
    with _lock:
        was_open = _open_since is not None
        _open_since = time.monotonic()
    if not was_open:
        # First failure in this outage window — one log line, not a flood.
        log.warning(
            "DB outage detected: %s — circuit OPEN (requests will 503 fast)", reason
        )


def record_success() -> None:
    """Record a successful DB touch — closes the breaker."""
    global _open_since
    with _lock:
        was_open = _open_since is not None
        _open_since = None
    if was_open:
        log.warning("DB recovered — circuit CLOSED, traffic resuming")


def is_open() -> bool:
    """True while the breaker considers the DB down.

    An open breaker auto-closes after RESET_SECONDS (half-open): the next
    request pays one real connection attempt and acts as the probe. If
    MySQL is still down, ``record_failure`` re-opens the breaker at once.
    """
    with _lock:
        if _open_since is None:
            return False
        if time.monotonic() - _open_since >= RESET_SECONDS:
            # Half-open: let one request through to act as the probe.
            return False
        return True


def reset_for_tests() -> None:
    """Close the breaker (test isolation — production code never calls this)."""
    global _open_since
    with _lock:
        _open_since = None
