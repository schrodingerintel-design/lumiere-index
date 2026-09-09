"""In-process ingest scheduler — runs the adapters even without Celery.

The scheduled Celery worker/beat are separate processes that are not part of
the API deployment, which left Reddit/Wikipedia/Trends/Letterboxd never
ingesting in production (only the TMDB catalog sync, which runs on app boot,
ever executed). This loop gives the API process its own cadence so signal
collection actually happens.

Notes:
  * Mention inserts are idempotent per (source_id, external_id), so overlapping
    runs are harmless.
  * Each run records per-source health counters (records requested/received/
    processed/rejected, api/rate-limit errors) for the Signal Health view.
  * Missing API keys are reported via the same counters — a source without a
    key shows up as "No key" instead of silently doing nothing.
  * If a database rollback leaves the session unusable, it is recreated.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

log = logging.getLogger(__name__)

# ── cadence (seconds) — mirrors the Celery beat schedule ─────────────────────
_INTERVALS = {
    "ingest_reddit": 600,
    "ingest_news": 900,
    "ingest_youtube": 1800,
    "ingest_tiktok": 1800,
    "ingest_wikipedia": 3600,
    "ingest_trends": 3600,
    "ingest_letterboxd": 1800,
    "discover_candidates": 600,
    "recompute_rankings": 900,
    "rollup_daily": 3600,
    # Official publication cadence — idempotent per date/week, so checking
    # hourly is the safe way to guarantee a same-day publication without
    # duplicates (the publish job itself is a no-op once published).
    "publish_daily_index": 3600,
    "publish_weekly_index": 6 * 3600,
}

_last_run: dict[str, float] = {}
_last_run_ts: dict[str, str] = {}


def last_run_times() -> dict[str, str]:
    """Timestamps of the last completed run per task (for diagnostics)."""
    return dict(_last_run_ts)


def _due(task: str) -> bool:
    now = time.monotonic()
    if now - _last_run.get(task, 0.0) >= _INTERVALS[task]:
        _last_run[task] = now
        _last_run_ts[task] = datetime.now(timezone.utc).isoformat()
        return True
    return False


def _run_task(name: str) -> None:
    """Execute a task in its own DB session; never propagate exceptions."""
    from app.db import SessionLocal
    from app.workers import tasks

    try:
        fn = getattr(tasks, name)
        with SessionLocal() as db:
            # Tasks open their own sessions internally where needed; pass ours
            # for the simple ingest paths and let the task function decide.
            if name in ("recompute_rankings", "rollup_daily"):
                fn()
            else:
                fn()
        log.info("scheduler: %s completed", name)
    except Exception as exc:
        log.warning("scheduler: %s failed — %s", name, exc)
        try:
            # If the failure poisoned a shared session, reset it.
            from app.db import engine
            engine.dispose()
        except Exception:
            pass


async def _loop() -> None:
    # Stagger first runs so app boot isn't hit with 10 jobs at once; rankings
    # recompute early so fresh ingest data shows up quickly.
    start_delays = {
        "recompute_rankings": 5,
        "ingest_reddit": 20,
        "discover_candidates": 45,
        "ingest_wikipedia": 60,
        "ingest_trends": 90,
        "ingest_letterboxd": 120,
        "ingest_news": 150,
        "ingest_youtube": 180,
        "ingest_tiktok": 210,
        "rollup_daily": 240,
        "publish_daily_index": 300,
        "publish_weekly_index": 330,
    }
    booted_at = time.monotonic()
    for task, delay in start_delays.items():
        _last_run[task] = booted_at - (_INTERVALS[task] - delay)

    while True:
        try:
            for task in _INTERVALS:
                if _due(task):
                    await asyncio.to_thread(_run_task, task)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("scheduler: cycle error — %s", exc)
        await asyncio.sleep(30)


def start() -> asyncio.Task:
    """Start the scheduler loop as an asyncio task on the running event loop."""
    log.info("scheduler: starting in-process ingest loop")
    return asyncio.create_task(_loop(), name="lumiere-ingest-scheduler")
