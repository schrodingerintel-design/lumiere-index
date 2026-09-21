"""Momentum — deterministic, rank-trajectory-based, score-independent.

Momentum is the public state of change. Contract locked here:

  1. deterministic: same inputs → same label, no randomness, no LLM
  2. score-independent: labels come from rank movement, never score values —
     a #1 can COOL while a #26 SURGES
  3. thresholds absorb noise: a one-position move never changes the label
  4. insufficient history → STEADY, never an invented label
  5. NEW entries: top-debut SURGES in, a low debut is STEADY
  6. trajectory corroboration: a big one-step jump without a climbing
     trend does not read SURGING
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.models import Film, Ranking, Source, Mention
from app.services.momentum import momentum_for_films, _classify


NOW = datetime(2026, 9, 21, 12, 0, tzinfo=timezone.utc)


def _snap_rows(db, fid, chart, series):
    """series: list of (snapshot_at, rank, prev_rank)."""
    for i, (snap_at, rank, prev) in enumerate(series):
        db.add(Ranking(
            snapshot_at=snap_at, chart_type=chart, film_id=fid,
            rank=rank, score=50.0, prev_rank=prev, movement=0,
            peak_rank=rank, weeks_on_chart=1, sample_size=10,
            ca_score=0.5, momentum_score=0.5, recency_score=0.5,
            ae_score=0.5, cp_score=0.5,
        ))
    db.commit()


def _film(db, slug):
    f = Film(slug=slug, title=slug.title(), year=2025)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


# ── 1. determinism ───────────────────────────────────────────────────────────

def test_same_inputs_same_label(db_session):
    f = _film(db_session, "det-mom")
    day = lambda d: NOW - timedelta(days=d)
    series = [(day(3), 10, 12), (day(2), 8, 10), (day(1), 6, 8), (day(0), 4, 6)]
    _snap_rows(db_session, f.id, "MOVIE_100", series)
    args = ({f.id: (4, 6)}, "MOVIE_100")
    a = momentum_for_films(db_session, *args, now=NOW)[f.id].state
    b = momentum_for_films(db_session, *args, now=NOW)[f.id].state
    assert a == b == "RISING"


# ── 2. score independence: #1 cools, #26 surges ─────────────────────────────

def test_number_one_can_cool(db_session):
    f = _film(db_session, "king-cools")
    day = lambda d: NOW - timedelta(days=d)
    _snap_rows(db_session, f.id, "MOVIE_100", [
        (day(3), 1, 1), (day(2), 1, 1), (day(1), 1, 1), (day(0), 1, 1),
    ])
    # Held #1 for days, then slipped to #4 this step.
    state = momentum_for_films(
        db_session, {f.id: (4, 1)}, "MOVIE_100", now=NOW
    )[f.id].state
    assert state == "COOLING"


def test_rank_twenty_six_can_surge(db_session):
    f = _film(db_session, "underdog")
    day = lambda d: NOW - timedelta(days=d)
    _snap_rows(db_session, f.id, "MOVIE_100", [
        (day(2), 38, 41), (day(1), 33, 38), (day(0), 26, 33),
    ])
    state = momentum_for_films(
        db_session, {f.id: (26, 33)}, "MOVIE_100", now=NOW
    )[f.id].state
    assert state == "SURGING"


# ── 3. noise absorption ──────────────────────────────────────────────────────

def test_one_position_move_is_steady(db_session):
    f = _film(db_session, "jitter")
    day = lambda d: NOW - timedelta(days=d)
    _snap_rows(db_session, f.id, "MOVIE_100", [
        (day(2), 9, 10), (day(1), 10, 9), (day(0), 9, 10),
    ])
    state = momentum_for_films(
        db_session, {f.id: (9, 10)}, "MOVIE_100", now=NOW
    )[f.id].state
    assert state == "STEADY"


# ── 4. insufficient history ──────────────────────────────────────────────────

def test_single_day_history_is_steady_regardless_of_step(db_session):
    f = _film(db_session, "sparse")
    _snap_rows(db_session, f.id, "MOVIE_100", [(NOW, 40, 41)])
    # prev exists so not NEW, but only ONE distinct day of history.
    state = momentum_for_films(
        db_session, {f.id: (40, 41)}, "MOVIE_100", now=NOW
    )[f.id].state
    assert state == "STEADY"


# ── 5. new entries ───────────────────────────────────────────────────────────

def test_top_debut_surges_low_debut_steady(db_session):
    top = _film(db_session, "debut-top")
    low = _film(db_session, "debut-low")
    _snap_rows(db_session, top.id, "MOVIE_100", [(NOW, 3, None)])
    _snap_rows(db_session, low.id, "MOVIE_100", [(NOW, 55, None)])
    out = momentum_for_films(
        db_session, {top.id: (3, None), low.id: (55, None)}, "MOVIE_100", now=NOW
    )
    assert out[top.id].state == "SURGING"
    assert out[low.id].state == "STEADY"


# ── 6. trajectory corroboration ──────────────────────────────────────────────

def test_breakout_jump_from_flat_base_is_surging(db_session):
    f = _film(db_session, "breaker")
    day = lambda d: NOW - timedelta(days=d)
    # Flat around #30 for days, then one big jump to #20 — a breakout:
    # rapidly gaining attention, exactly what SURGING means.
    _snap_rows(db_session, f.id, "MOVIE_100", [
        (day(3), 30, 30), (day(2), 31, 30), (day(1), 30, 31), (day(0), 20, 30),
    ])
    state = momentum_for_films(
        db_session, {f.id: (20, 30)}, "MOVIE_100", now=NOW
    )[f.id].state
    assert state == "SURGING"


def test_steady_climb_is_rising_not_surging(db_session):
    f = _film(db_session, "climber")
    day = lambda d: NOW - timedelta(days=d)
    # Consistent 2-positions/day climb — real but not dramatic.
    _snap_rows(db_session, f.id, "MOVIE_100", [
        (day(3), 30, 32), (day(2), 28, 30), (day(1), 26, 28), (day(0), 24, 26),
    ])
    state = momentum_for_films(
        db_session, {f.id: (24, 26)}, "MOVIE_100", now=NOW
    )[f.id].state
    assert state == "RISING"


def test_persistent_slide_is_falling(db_session):
    f = _film(db_session, "slider")
    day = lambda d: NOW - timedelta(days=d)
    _snap_rows(db_session, f.id, "MOVIE_100", [
        (day(3), 8, 6), (day(2), 14, 8), (day(1), 22, 14), (day(0), 30, 22),
    ])
    state = momentum_for_films(
        db_session, {f.id: (30, 22)}, "MOVIE_100", now=NOW
    )[f.id].state
    assert state == "FALLING"


# ── 7. pure classifier edges ─────────────────────────────────────────────────

def test_reentry_without_history_is_honest():
    # Returned at #5 with no readable history (pruned): surge-in.
    assert _classify(5, None, []).state == "SURGING"
    # Returned at #60 with no readable history: STEADY, not invented.
    assert _classify(60, None, []).state == "STEADY"


def test_empty_chart_query_is_safe(db_session):
    assert momentum_for_films(db_session, {}, "MOVIE_100", now=NOW) == {}
