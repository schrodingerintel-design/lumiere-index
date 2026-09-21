"""Momentum — the public-facing state of change for a chart entry.

Momentum describes how quickly an entry's cultural attention is changing.
It is DERIVED, deterministic and explainable — never from the composite
score's value, never from score ranges, and never by an LLM. The internal
scoring/ranking engine is untouched; Momentum is computed at read time from
the same continuous snapshot history the chart already keeps.

States
──────
SURGING   strong, accelerating upward movement
RISING    solid upward movement
STEADY    flat / noise-level change / insufficient history
COOLING   clear downward movement that has not collapsed
FALLING   strong downward movement

Why rank-trajectory, not score: the score measures absolute attention, so
its movement conflates "the world got louder" with "this title climbed".
Rank movement is the zero-sum signal: for one title to rise, another must
fall. That makes Momentum legible: SURGING means "winning attention right
now", regardless of chart position — a #1 can COOL while a #26 SURGES.

Data used (all existing — no schema change)
───────────────────────────────────────────
Per chart, per title, the continuous 15-minute Ranking series:
  · current rank, previous published rank (movement since last snapshot)
  · the sampled daily rank series over the last `rank_history_days`
    (the same sampling the film page history chart uses)
  · a title is NEW when it has exactly one snapshot row on its chart

Label rules (deterministic thresholds)
──────────────────────────────────────
A title needs at least `min_snapshots` distinct snapshot days of history
before anything other than STEADY is assigned (insufficient data → STEADY).

  improvement = prev_rank − current_rank      (positive = climbed)
  slope       = median per-day rank change over the recent window
                (negative days = climbing days)
  net         = first − last of the window    (positive = net climb)

  SURGING   improvement ≥ surge_thresh AND slope indicates climbing AND
            (net > 0 or NEW with improvement ≥ new_surge_thresh)
  RISING    (improvement ≥ rise_thresh AND not falling) OR
            (net ≥ rise_thresh AND slope ≤ 0)
  FALLING   −improvement ≥ surge_thresh AND slope ≥ fall_daily
  COOLING   −improvement ≥ rise_thresh
  STEADY    everything else, including all noise between thresholds

Thresholds absorb normal 15-minute jitter: a one-position move is never
enough to change the label.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.score import Ranking

MomentumState = Literal["SURGING", "RISING", "STEADY", "COOLING", "FALLING"]

# ── thresholds (rank positions; jitter-absorbing) ────────────────────────────
SURGE_THRESH = 5          # ≥5 positions in one step = dramatic move
RISE_THRESH = 2           # ≥2 positions = real move; 1 position = noise
FALL_DAILY = 0.5          # median ≥ +0.5 positions/day down = deteriorating
NEW_SURGE_THRESH = 8      # a NEW entry debuting into the top ~8 is surging in
MIN_HISTORY_DAYS = 2      # need ≥2 distinct snapshot days before labelling
WINDOW_DAYS = 7           # trajectory window for the slope


@dataclass(frozen=True)
class Momentum:
    state: MomentumState
    """The label — one of the five states above."""


def momentum_for_films(
    db: Session,
    film_ranks: dict[int, tuple[int, int | None]],
    chart_type: str,
    now: datetime | None = None,
) -> dict[int, Momentum]:
    """Bulk-compute Momentum for one chart's rows.

    `film_ranks` maps film_id → (current_rank, prev_rank). Missing entries
    get STEADY. Pure read-time computation on existing history.
    """
    if not film_ranks:
        return {}
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=WINDOW_DAYS)

    fids = list(film_ranks)
    # One bulk query: every row on this chart in the window, oldest first.
    rows = db.execute(
        select(Ranking.film_id, func.date(Ranking.snapshot_at).label("d"), Ranking.rank)
        .where(
            Ranking.film_id.in_(fids),
            Ranking.chart_type == chart_type,
            Ranking.snapshot_at >= cutoff,
        )
        .order_by(Ranking.film_id.asc(), Ranking.snapshot_at.asc())
    ).all()

    series: dict[int, list[tuple[str, int]]] = {}
    for fid, day, rank in rows:
        series.setdefault(fid, []).append((str(day), int(rank)))

    out: dict[int, Momentum] = {}
    for fid, (current, prev) in film_ranks.items():
        out[fid] = _classify(int(current), prev, series.get(fid, []))
    return out


def _classify(current: int, prev: int | None, raw_series: list[tuple[str, int]]) -> Momentum:
    # NEW: exactly one distinct day on the chart.
    distinct_days = {d for d, _ in raw_series}
    if len(distinct_days) <= 1 and prev is None:
        # New entry — label by debut strength, otherwise omit (STEADY).
        if current <= NEW_SURGE_THRESH:
            return Momentum("SURGING")
        return Momentum("STEADY")

    if prev is None:
        # Re-entry: previously on the chart, now back. Treat the step itself
        # as the signal (the series may be empty if history was pruned).
        improvement = -current  # returned at `current`; direction unknown
        if current <= NEW_SURGE_THRESH:
            return Momentum("SURGING")
        return Momentum("RISING") if current <= 40 else Momentum("STEADY")

    improvement = prev - current  # positive = climbed since last snapshot

    # Sampled daily series (one row per day, the last snapshot of each day).
    daily: list[int] = []
    seen: set[str] = set()
    for day, rank in reversed(raw_series):
        if day in seen:
            continue
        seen.add(day)
        daily.append(rank)
    daily.reverse()  # chronological

    slope = 0.0
    net = 0
    if len(distinct_days) >= MIN_HISTORY_DAYS and len(daily) >= 2:
        diffs = [b - a for a, b in zip(daily, daily[1:])]
        slope = median(diffs)
        net = daily[0] - daily[-1]

    enough_history = len(distinct_days) >= MIN_HISTORY_DAYS

    # FALLING: dramatic drop with a deteriorating slope.
    if -improvement >= SURGE_THRESH and enough_history and slope >= FALL_DAILY:
        return Momentum("FALLING")
    # SURGING: dramatic climb, corroborated by the trajectory.
    if improvement >= SURGE_THRESH and enough_history and (slope <= 0 or net > 0):
        return Momentum("SURGING")
    # RISING: real climb (step or net), not deteriorating.
    if improvement >= RISE_THRESH and slope <= FALL_DAILY:
        return Momentum("RISING")
    if enough_history and net >= RISE_THRESH and slope <= 0:
        return Momentum("RISING")
    # COOLING: real drop, not catastrophic.
    if -improvement >= RISE_THRESH:
        return Momentum("COOLING")
    return Momentum("STEADY")
