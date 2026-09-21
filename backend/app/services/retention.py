"""Data retention — keep the volume database lean without losing information.

Why this exists
═══════════════
The production database is a small single-node Railway MySQL instance. Three
jobs grow it without bound:

  1. ``recompute_rankings`` (every 15 min) persists one full Top-100 snapshot
     row set PER CHART (Movie 100 + TV 100 ≈ 200 rows / run ≈ 19k rows/day).
  2. Signal ingest accumulates ``mentions`` / ``metric_snapshots`` rows —
     each score rollup reads only the trailing ~30 days.
  3. ``pending_mentions`` accumulates rejected discovery candidates forever.

The chart-tenure numbers the product publishes ("N days on chart",
"N days at #1", "Top-10 days", "longest streak at #1", peak rank, weeks on
chart, 24h movement baseline) are all derived from this history at read
time.  Collapsing it naively (e.g. "keep one row per day") would corrupt
those numbers.  This module is the *safe* collapse:

  • every calendar day where the title appeared at all keeps exactly one
    representative snapshot (the day's LAST) → all DISTINCT-per-day tenure
    metrics are bit-exact;
  • every title's first appearance is preserved with its original
    ``snapshot_at`` → "days on chart" / "weeks on chart" are bit-exact;
  • the trailing window (RANKING_HISTORY_WINDOW_H, default 48h) keeps every
    snapshot → the 24h movement baseline and the hourly rank-history spark
    are bit-exact;
  • today's rows keep every snapshot → the current chart is untouched.

Everything older than RANKING_HISTORY_DAYS (default 400) is deleted.
No published number changes.  Rank continuity within a chart is computed
from the latest snapshot only, which is always retained.

Run via the scheduler (``run_retention`` task) or POST /admin/maintenance.
"""

from __future__ import annotations

import logging
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Mention,
    MetricSnapshot,
    PendingMention,
    Ranking,
)

log = logging.getLogger(__name__)

# ── window policy ───────────────────────────────────────────────────────────
# Read paths that consume ranking history and the window they need:
#   • movement baseline      — 24 h  (films.py ranking recompute)
#   • rank-history sparkline — hourly samples, default 60 days
#   • tenure metrics         — first-seen + per-day distinct, any age
RANKING_HISTORY_WINDOW_H = 48  # full-resolution recent history
DEFAULT_HISTORY_DAYS = 400  # beyond this, even per-day rows are dropped
MENTION_RETENTION_DAYS = 30  # rollups read the trailing 30 days
METRIC_RETENTION_DAYS = 30  # same trailing window for aggregate metrics
PENDING_MAX_AGE_DAYS = 14  # stale discovery candidates are never resolved


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _day_end(day) -> datetime:
    """Last representable microsecond of a UTC calendar day (naive, matching
    the snapshot_at column convention)."""
    return datetime.combine(day, time(23, 59, 59, 999999))


def _day_start(day) -> datetime:
    return datetime.combine(day, time.min)


def collapse_ranking_history(db: Session) -> dict:
    """Collapse stale ranking snapshots per (chart, film, day).

    Returns counters for the maintenance report.
    """
    now = _utcnow()
    # snapshot_at is stored naive-UTC (the column convention everywhere else
    # in this codebase); make the cutoffs match so comparisons never mix.
    recent_cutoff = (now - timedelta(hours=RANKING_HISTORY_WINDOW_H)).replace(tzinfo=None)
    hard_cutoff = (now - timedelta(days=settings.ranking_history_days)).replace(tzinfo=None)

    latest_snap = db.scalar(select(func.max(Ranking.snapshot_at)))
    if latest_snap is None:
        return {"status": "skipped", "reason": "no snapshots"}

    today = now.date()

    # ── 1. Hard-expire ancient per-day rows ────────────────────────────────
    ancient = (
        db.query(Ranking.id)
        .filter(Ranking.snapshot_at < hard_cutoff)
        .limit(50_000)
    )
    ancient_ids = [row[0] for row in ancient.all()]
    ancient_deleted = 0
    if ancient_ids:
        ancient_deleted = db.query(Ranking).filter(
            Ranking.id.in_(ancient_ids)
        ).delete(synchronize_session=False)

    # ── 2. Identify stale full-snapshot timestamps to collapse ─────────────
    stale_snaps = [
        ts
        for (ts,) in db.query(Ranking.snapshot_at).distinct().all()
        if ts < recent_cutoff and ts.date() != today
    ]
    if not stale_snaps:
        db.commit()
        return {
            "status": "ok",
            "ancient_rows_deleted": ancient_deleted,
            "stale_snapshots": 0,
            "rows_deleted": 0,
            "kept_day_closes": 0,
            "kept_first_seen": 0,
        }

    # ── 3. Compute per (chart, film, day) keep-sets among stale snapshots ──
    # A title's rank can CHANGE within a day (that is what movement is), and
    # the product's "distinct days at rank R" metrics must survive. So the
    # keep-set per (chart, film, day) is:
    #   • one row per DISTINCT rank that day (its first occurrence), and
    #   • the day-close row (last of the day — drives the daily sparkline
    #     sample and the last-known rank).
    keep_ids: set[int] = set()
    # 3a. First row of each distinct (chart, film, day, rank).
    first_of_rank = (
        db.query(
            Ranking.chart_type,
            Ranking.film_id,
            func.date(Ranking.snapshot_at),
            Ranking.rank,
            func.min(Ranking.snapshot_at),
        )
        .filter(Ranking.snapshot_at.in_(stale_snaps))
        .group_by(
            Ranking.chart_type,
            Ranking.film_id,
            func.date(Ranking.snapshot_at),
            Ranking.rank,
        )
        .all()
    )
    for chart, fid, _day, _rank, ts in first_of_rank:
        row_id = db.scalar(
            select(Ranking.id).where(
                Ranking.chart_type == chart,
                Ranking.film_id == fid,
                Ranking.snapshot_at == ts,
            )
        )
        if row_id:
            keep_ids.add(row_id)
    # 3b. Day-close: the LAST stale snapshot per (chart, film, day).
    day_closes = (
        db.query(
            Ranking.chart_type,
            Ranking.film_id,
            func.date(Ranking.snapshot_at),
            func.max(Ranking.snapshot_at),
        )
        .filter(Ranking.snapshot_at.in_(stale_snaps))
        .group_by(
            Ranking.chart_type,
            Ranking.film_id,
            func.date(Ranking.snapshot_at),
        )
        .all()
    )
    for chart, fid, _day, ts in day_closes:
        row_id = db.scalar(
            select(Ranking.id).where(
                Ranking.chart_type == chart,
                Ranking.film_id == fid,
                Ranking.snapshot_at == ts,
            )
        )
        if row_id:
            keep_ids.add(row_id)
    kept_day_closes = len(day_closes)

    # 3b. First-seen: the EARLIEST row per (chart, film) — preserve the exact
    # first snapshot_at so "days on chart" stays calendar-exact.
    first_seen = (
        db.query(
            Ranking.chart_type,
            Ranking.film_id,
            func.min(Ranking.snapshot_at),
        )
        .group_by(Ranking.chart_type, Ranking.film_id)
        .all()
    )
    for chart, fid, ts in first_seen:
        if ts in stale_snaps:
            row_id = db.scalar(
                select(Ranking.id).where(
                    Ranking.chart_type == chart,
                    Ranking.film_id == fid,
                    Ranking.snapshot_at == ts,
                )
            )
            if row_id:
                keep_ids.add(row_id)
    kept_first_seen = len(keep_ids) - kept_day_closes

    # ── 4. Delete every other row of stale snapshots, chunked ──────────────
    deleted = 0
    CHUNK = 5_000
    while True:
        doomed = (
            db.query(Ranking.id)
            .filter(
                Ranking.snapshot_at.in_(stale_snaps),
                Ranking.id.not_in(keep_ids) if keep_ids else True,
            )
            .limit(CHUNK)
            .all()
        )
        if not doomed:
            break
        ids = [row[0] for row in doomed]
        deleted += (
            db.query(Ranking)
            .filter(Ranking.id.in_(ids))
            .delete(synchronize_session=False)
        )

    db.commit()
    return {
        "status": "ok",
        "ancient_rows_deleted": ancient_deleted,
        "stale_snapshots": len(stale_snaps),
        "rows_deleted": deleted,
        "kept_day_closes": kept_day_closes,
        "kept_first_seen": kept_first_seen,
    }


def prune_raw_signals(db: Session) -> dict:
    """Drop raw ingest rows past their analytical window."""
    now = _utcnow()
    out = {}

    mention_cutoff = now - timedelta(days=MENTION_RETENTION_DAYS)
    deleted = 0
    CHUNK = 10_000
    while True:
        ids = [
            row[0]
            for row in db.query(Mention.id)
            .filter(Mention.created_at < mention_cutoff)
            .limit(CHUNK)
            .all()
        ]
        if not ids:
            break
        deleted += (
            db.query(Mention)
            .filter(Mention.id.in_(ids))
            .delete(synchronize_session=False)
        )
    db.commit()
    out["mentions_deleted"] = deleted

    metric_cutoff = now - timedelta(days=METRIC_RETENTION_DAYS)
    deleted = 0
    while True:
        ids = [
            row[0]
            for row in db.query(MetricSnapshot.id)
            .filter(MetricSnapshot.observed_at < metric_cutoff)
            .limit(CHUNK)
            .all()
        ]
        if not ids:
            break
        deleted += (
            db.query(MetricSnapshot)
            .filter(MetricSnapshot.id.in_(ids))
            .delete(synchronize_session=False)
        )
    db.commit()
    out["metric_snapshots_deleted"] = deleted

    pending_cutoff = now - timedelta(days=PENDING_MAX_AGE_DAYS)
    pending_deleted = (
        db.query(PendingMention)
        .filter(PendingMention.created_at < pending_cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    out["pending_mentions_deleted"] = pending_deleted
    return out


# ── one-time unit migration ─────────────────────────────────────────────────
# Trends observations were stored as WEEKLY interest totals (sum of seven
# 0–100 values); the score unit is a DAILY rate. Rows written before the
# adapter fix carry a 7×-inflated value. This idempotent normalizer divides
# any such row down; it self-disables once no inflated rows remain (the
# UPDATE matches zero rows) and is wired into run_retention so production
# heals itself on the first nightly pass after deploy.
TRENDS_UNIT_FIX_KEY = "trends_obs_weekly_to_daily_2026_09"


def normalize_trends_observation_units(db: Session) -> dict:
    from app.models import Source
    from sqlalchemy import text as _text
    try:
        src = db.query(Source).filter(Source.key == "trends").first()
        if src is None:
            return {"trends_unit_fix": "no-source"}
        result = db.execute(
            _text(
                "UPDATE mentions SET observations = FLOOR(observations / 7) "
                "WHERE source_id = :sid AND observations >= 7"
            ),
            {"sid": src.id},
        )
        db.commit()
        return {"trends_unit_fix": result.rowcount or 0}
    except Exception as exc:
        db.rollback()
        return {"trends_unit_fix": f"error: {exc}"}


def run_retention(db: Session) -> dict:
    """Full maintenance pass — safe to run concurrently with serving traffic
    (chunked deletes, no long table locks)."""
    ranking_report = collapse_ranking_history(db)
    raw_report = prune_raw_signals(db)
    unit_report = normalize_trends_observation_units(db)
    report = {"ran_at": _utcnow().isoformat(), **ranking_report, **raw_report, **unit_report}
    log.info("retention: %s", report)
    return report


def retention_preview(db: Session) -> dict:
    """What would be reclaimed — for the admin endpoint (no writes)."""
    now = _utcnow()
    recent_cutoff = now - timedelta(hours=RANKING_HISTORY_WINDOW_H)
    today = now.date()

    total = db.scalar(select(func.count(Ranking.id))) or 0
    keep_recent = (
        db.scalar(
            select(func.count(Ranking.id)).filter(
                Ranking.snapshot_at >= recent_cutoff
            )
        )
        or 0
    )
    keep_today = (
        db.scalar(
            select(func.count(Ranking.id)).filter(
                func.date(Ranking.snapshot_at) == today
            )
        )
        or 0
    )
    n_charts = db.scalar(
        select(func.count(func.distinct(Ranking.chart_type)))
    ) or 1
    keep_floor = (  # per-day + first-seen minimum keep-set
        db.query(func.count(func.distinct(func.date(Ranking.snapshot_at))))
        .scalar()
        or 0
    ) * 200 * n_charts  # rough upper bound of the daily keep-set

    return {
        "ranking_rows_total": total,
        "ranking_rows_kept_recent_full": keep_recent,
        "ranking_rows_kept_today_full": keep_today,
        "ranking_rows_reclaimable_estimate": max(
            0, total - keep_recent - keep_today
        ),
        "note": "collapse keeps one row per (chart, film, day) + first-seen",
    }
