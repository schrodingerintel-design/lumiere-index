"""Structured logging setup for FastAPI application."""
import logging
import sys
import threading
import time

import structlog

# ── Failure-flood control ────────────────────────────────────────────────────
# During the 2026-09-20 MySQL outage the API logged the same connection
# traceback once per request — over Railway's 500 logs/sec cap, which got
# 1,722 messages DROPPED (hiding the useful signal along with the noise).
# log_throttled lets hot failure paths (readyz probes, per-endpoint DB
# errors, scheduler tasks) log the first occurrence and then stay silent for
# a window, reporting how many repeats were suppressed on the next flush.

_log_lock = threading.Lock()
_log_state: dict[str, tuple[float, int]] = {}


def log_throttled(
    key: str,
    logger: logging.Logger,
    level: int,
    msg: str,
    *args,
    every: float = 60.0,
) -> None:
    """Log at most once per ``every`` seconds per ``key``.

    The first call logs immediately; repeats inside the window are counted
    and reported as a single "suppressed N earlier repeats" line when the
    window expires. Keys are a small fixed set (per-endpoint/per-task), so
    the state map stays bounded.
    """
    now = time.monotonic()
    with _log_lock:
        last, suppressed = _log_state.get(key, (0.0, 0))
        due = now - last >= every
        if due:
            _log_state[key] = (now, 0)
        else:
            _log_state[key] = (last, suppressed + 1)
    if due:
        logger.log(level, msg, *args)
        if suppressed:
            logger.log(
                level,
                "… suppressed %d earlier repeats of %s",
                suppressed,
                key,
            )


def setup_logging() -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if sys.stdout.isatty() else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


logger = structlog.get_logger()
