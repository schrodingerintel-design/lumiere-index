"""Comprehensive tests for the five-component ranking engine.

Tests cover:
  1. EWMA helper
  2. R_raw linear decay (day 0 = 1.0, day 21 = 0.0, day 22+ = 0.0)
  3. Percentile rank helper
  4. New film (3 days data) outranks old film (30 days fading data)
  5. Minimum sample floor — 1-day film gets safe defaults, not noise rank
  6. Declining film falls below a film with fresh current data
  7. Sub-score columns are populated for every ranking row
  8. Sub-score normalization — all values are in [0, 1]
  9. Recency score is zero for a film released > 21 days ago
 10. Recency score is nonzero for a film released < 21 days ago
"""
import math
from datetime import date, datetime, timedelta, timezone

import pytest

from app.models import DailyScore, Film, Mention, Source, Ranking
from app.services.ranking import (
    _ewma_series,
    _percentile_rank,
    recompute_rankings,
)


# ── 1. EWMA helper ────────────────────────────────────────────────────────────

def test_ewma_single_value():
    assert _ewma_series([5.0], half_life_days=3.0) == [5.0]


def test_ewma_constant_series():
    """EWMA of a constant series should equal the constant."""
    result = _ewma_series([3.0, 3.0, 3.0, 3.0], half_life_days=2.0)
    for v in result:
        assert abs(v - 3.0) < 1e-9


def test_ewma_rising_series():
    """Short half-life should track a rising series faster (higher final value)."""
    series = [1.0, 2.0, 3.0, 4.0, 5.0]
    fast = _ewma_series(series, half_life_days=1.0)
    slow = _ewma_series(series, half_life_days=10.0)
    assert fast[-1] > slow[-1]


def test_ewma_short_minus_long_positive_for_rising():
    """EWMA_short − EWMA_long should be positive when series is rising."""
    series = [0.5] * 5 + [3.0] * 5   # flat then spike
    short = _ewma_series(series, half_life_days=1.5)
    long_ = _ewma_series(series, half_life_days=7.0)
    assert short[-1] > long_[-1]      # rising → positive momentum


def test_ewma_short_minus_long_negative_for_falling():
    """EWMA_short − EWMA_long should be negative when series is falling."""
    series = [5.0] * 5 + [0.1] * 5   # high then collapses
    short = _ewma_series(series, half_life_days=1.5)
    long_ = _ewma_series(series, half_life_days=7.0)
    assert short[-1] < long_[-1]      # falling → negative momentum


# ── 2. Percentile rank helper ─────────────────────────────────────────────────

def test_percentile_rank_empty_pool():
    assert _percentile_rank(5.0, []) == 0.0


def test_percentile_rank_highest():
    """Highest value in pool → percentile just below 1.0."""
    pool = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert _percentile_rank(5.0, pool) == pytest.approx(0.8)  # 4/5 below 5.0


def test_percentile_rank_lowest():
    pool = [1.0, 2.0, 3.0]
    assert _percentile_rank(1.0, pool) == 0.0


# ── seed helpers ──────────────────────────────────────────────────────────────

def _add_film(db, slug, title, release_date=None):
    f = Film(slug=slug, title=title, year=2025, release_date=release_date)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def _add_daily(db, film_id, day, mentions, sentiment=0.0):
    db.add(DailyScore(
        film_id=film_id, day=day,
        mentions_count=mentions,
        weighted_score=float(mentions),
        sentiment_avg=sentiment,
    ))


def _add_source(db, key="test"):
    src = Source(key=key, name="Test Source", weight=1.0)
    db.add(src)
    db.commit()
    db.refresh(src)
    return src


def _add_mention(db, film_id, source_id, hours_ago, engagement=10, ext_id_suffix=""):
    db.add(Mention(
        film_id=film_id,
        source_id=source_id,
        external_id=f"m-{film_id}-{hours_ago}-{ext_id_suffix}",
        engagement=engagement,
        created_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago),
    ))


# ── 3. R_raw decay boundary tests ─────────────────────────────────────────────

def test_recency_score_day_0(db_session):
    """A film released today should have R = 1.0 (max recency)."""
    src = _add_source(db_session)
    today = date.today()
    film = _add_film(db_session, "fresh", "Fresh Film", release_date=today)
    # One mention so it enters the pool
    _add_mention(db_session, film.id, src.id, 1, ext_id_suffix="r0")
    db_session.commit()
    recompute_rankings(db_session)
    r = db_session.query(Ranking).filter(Ranking.film_id == film.id).order_by(Ranking.id.desc()).first()
    assert r is not None
    assert r.recency_score == pytest.approx(1.0, abs=0.01)


def test_recency_score_day_21(db_session):
    """A film released exactly 21 days ago should have R = 0.0."""
    src = _add_source(db_session)
    old_date = date.today() - timedelta(days=21)
    film = _add_film(db_session, "day21", "Day 21 Film", release_date=old_date)
    _add_mention(db_session, film.id, src.id, 1, ext_id_suffix="d21")
    db_session.commit()
    recompute_rankings(db_session)
    r = db_session.query(Ranking).filter(Ranking.film_id == film.id).order_by(Ranking.id.desc()).first()
    assert r is not None
    assert r.recency_score == pytest.approx(0.0, abs=0.01)


def test_recency_score_day_30(db_session):
    """A film released 30+ days ago should have R = 0.0 (expired window)."""
    src = _add_source(db_session)
    old_date = date.today() - timedelta(days=30)
    film = _add_film(db_session, "old-release", "Old Release Film", release_date=old_date)
    _add_mention(db_session, film.id, src.id, 1, ext_id_suffix="d30")
    db_session.commit()
    recompute_rankings(db_session)
    r = db_session.query(Ranking).filter(Ranking.film_id == film.id).order_by(Ranking.id.desc()).first()
    assert r is not None
    assert r.recency_score == 0.0


# ── 4. New film outranks old fading film ───────────────────────────────────────

def test_new_film_with_high_current_attention_beats_old_fading_film(db_session):
    """
    KEY REGRESSION: a new 2026 film with 3 days of strong signals should
    outrank a 2025 film with 30 days of declining signals.
    """
    src = _add_source(db_session)
    today = date.today()

    # Old film: 30 days of history, all fading (max 20 mentions/day, now near zero)
    old_film = _add_film(db_session, "old-fading", "Old Fading Film",
                         release_date=today - timedelta(days=90))
    for i in range(30, 0, -1):
        day = today - timedelta(days=i)
        # Mentions taper sharply: lots at day 30, nearly zero recent
        mentions = max(0, int(20 * (i / 30)))
        _add_daily(db_session, old_film.id, day, mentions)

    # New film: 3 days only, but very active (100 mentions/day)
    new_film = _add_film(db_session, "new-hot", "New Hot Film",
                         release_date=today - timedelta(days=2))
    for i in range(3, 0, -1):
        day = today - timedelta(days=i)
        _add_daily(db_session, new_film.id, day, 100)

    # Add mentions for CP/AE (need at least one row in mentions table)
    _add_mention(db_session, old_film.id, src.id, 72, ext_id_suffix="a")
    for j in range(5):
        _add_mention(db_session, new_film.id, src.id, j + 1, engagement=200, ext_id_suffix=str(j))

    db_session.commit()
    snap = recompute_rankings(db_session)

    old_rank = db_session.query(Ranking).filter(
        Ranking.film_id == old_film.id, Ranking.snapshot_at == snap
    ).one()
    new_rank = db_session.query(Ranking).filter(
        Ranking.film_id == new_film.id, Ranking.snapshot_at == snap
    ).one()

    assert new_rank.rank < old_rank.rank, (
        f"Expected new hot film (rank {new_rank.rank}) to beat old fading film "
        f"(rank {old_rank.rank}), but it didn't. "
        f"Scores: new={new_rank.score}, old={old_rank.score}"
    )


# ── 5. Minimum sample floor ───────────────────────────────────────────────────

def test_single_day_film_does_not_crash(db_session):
    """Film with only 1 day of data should produce a valid ranking row (not error)."""
    src = _add_source(db_session)
    today = date.today()
    film = _add_film(db_session, "oneday", "One Day Film",
                     release_date=today - timedelta(days=1))
    _add_daily(db_session, film.id, today, 10)
    _add_mention(db_session, film.id, src.id, 2, ext_id_suffix="1d")
    db_session.commit()
    snap = recompute_rankings(db_session)
    r = db_session.query(Ranking).filter(
        Ranking.film_id == film.id, Ranking.snapshot_at == snap
    ).first()
    assert r is not None
    assert 0 <= r.score <= 98.5


# ── 6. Declining film falls ───────────────────────────────────────────────────

def test_declining_film_ranks_below_active_film(db_session):
    """
    A film that had big past data but zero recent activity should rank
    below a film that has steady current activity.
    """
    src = _add_source(db_session)
    today = date.today()

    # Ghost film: lots of activity 20-30 days ago, nothing since
    ghost = _add_film(db_session, "ghost", "Ghost Film",
                      release_date=today - timedelta(days=60))
    for i in range(30, 20, -1):
        day = today - timedelta(days=i)
        _add_daily(db_session, ghost.id, day, 500)
    # No recent DailyScore rows (i.e. zero recent mentions)

    # Active film: modest but steady presence for 14 days
    active = _add_film(db_session, "active", "Active Film",
                       release_date=today - timedelta(days=30))
    for i in range(14, 0, -1):
        day = today - timedelta(days=i)
        _add_daily(db_session, active.id, day, 30)

    # Mentions for CP
    _add_mention(db_session, active.id, src.id, 2, ext_id_suffix="act")
    _add_mention(db_session, ghost.id, src.id, 800, ext_id_suffix="gh")  # old mention

    db_session.commit()
    snap = recompute_rankings(db_session)

    ghost_rank = db_session.query(Ranking).filter(
        Ranking.film_id == ghost.id, Ranking.snapshot_at == snap
    ).one()
    active_rank = db_session.query(Ranking).filter(
        Ranking.film_id == active.id, Ranking.snapshot_at == snap
    ).one()

    assert active_rank.rank < ghost_rank.rank, (
        f"Expected active film (rank {active_rank.rank}) to beat ghost film "
        f"(rank {ghost_rank.rank}). "
        f"Scores: active={active_rank.score}, ghost={ghost_rank.score}"
    )


# ── 7. Sub-scores are populated ───────────────────────────────────────────────

def test_subscores_populated_after_recompute(db_session):
    """All five sub-score columns must be non-null after a recompute."""
    src = _add_source(db_session)
    today = date.today()
    film = _add_film(db_session, "sub-test", "Sub Score Film",
                     release_date=today - timedelta(days=5))
    for i in range(5, 0, -1):
        _add_daily(db_session, film.id, today - timedelta(days=i), 50)
    _add_mention(db_session, film.id, src.id, 3, ext_id_suffix="sc")
    db_session.commit()
    snap = recompute_rankings(db_session)
    r = db_session.query(Ranking).filter(
        Ranking.film_id == film.id, Ranking.snapshot_at == snap
    ).one()
    assert r.ca_score is not None
    assert r.momentum_score is not None
    assert r.recency_score is not None
    assert r.ae_score is not None
    assert r.cp_score is not None
    # Absolute evidence floor is stored per cycle
    assert r.sample_size is not None
    assert r.confidence in ("insufficient", "low", "moderate", "high")


# ── 8. Sub-scores are normalised to [0, 1] ────────────────────────────────────

def test_subscores_in_unit_range(db_session):
    """All sub-score columns should be in the closed interval [0, 1]."""
    src = _add_source(db_session)
    today = date.today()
    for idx in range(4):
        f = _add_film(db_session, f"norm-{idx}", f"Norm Film {idx}",
                      release_date=today - timedelta(days=idx * 7))
        for i in range(10, 0, -1):
            _add_daily(db_session, f.id, today - timedelta(days=i), (idx + 1) * 20)
        _add_mention(db_session, f.id, src.id, 5, ext_id_suffix=f"n{idx}")
    db_session.commit()
    snap = recompute_rankings(db_session)
    for r in db_session.query(Ranking).filter(Ranking.snapshot_at == snap).all():
        for attr in ("ca_score", "momentum_score", "recency_score", "ae_score", "cp_score"):
            val = getattr(r, attr)
            assert val is not None, f"{attr} is None for film_id={r.film_id}"
            assert 0.0 <= val <= 1.0, f"{attr}={val} out of [0,1] for film_id={r.film_id}"


# ── 9. CP decays for old cross-platform activity ──────────────────────────────

def test_cp_decays_for_old_cross_platform_activity(db_session):
    """A platform that was active weeks ago and silent since must stop counting
    toward Cross-Platform Reach — the same recency rule as Current Attention.
    Only platforms with non-trivial decay-weighted presence count, so cumulative
    30-day history can never inflate CP.
    """
    src_a = _add_source(db_session, "reddit")
    src_b = _add_source(db_session, "youtube")
    src_c = _add_source(db_session, "news")
    today = date.today()

    # Old film: 3 platforms active ~20 days ago (single day), nothing since.
    # Not active by the sample floor (1 active day, 3 mentions) → CP = 0.
    old_film = _add_film(db_session, "cp-old", "Old Cross-Platform",
                         release_date=today - timedelta(days=60))
    for src, hours in ((src_a, 480), (src_b, 481), (src_c, 482)):
        _add_mention(db_session, old_film.id, src.id, hours, ext_id_suffix=f"old-{src.key}")

    # Recent film: same 3 platforms, active today AND yesterday (2 active days).
    new_film = _add_film(db_session, "cp-new", "Recent Cross-Platform",
                         release_date=today - timedelta(days=2))
    for src, hours in ((src_a, 1), (src_b, 2), (src_c, 3)):
        _add_mention(db_session, new_film.id, src.id, hours, ext_id_suffix=f"new-{src.key}-t")
    for src, hours in ((src_a, 25), (src_b, 26), (src_c, 27)):
        _add_mention(db_session, new_film.id, src.id, hours, ext_id_suffix=f"new-{src.key}-y")

    # Mid film: only 1 platform active recently — fewer platforms than new film.
    mid_film = _add_film(db_session, "cp-mid", "Mid Cross-Platform",
                         release_date=today - timedelta(days=10))
    _add_mention(db_session, mid_film.id, src_a.id, 1, ext_id_suffix="mid-t")
    _add_mention(db_session, mid_film.id, src_a.id, 25, ext_id_suffix="mid-y")

    db_session.commit()
    snap = recompute_rankings(db_session)

    old = db_session.query(Ranking).filter(
        Ranking.film_id == old_film.id, Ranking.snapshot_at == snap
    ).one()
    new = db_session.query(Ranking).filter(
        Ranking.film_id == new_film.id, Ranking.snapshot_at == snap
    ).one()
    mid = db_session.query(Ranking).filter(
        Ranking.film_id == mid_film.id, Ranking.snapshot_at == snap
    ).one()

    assert old.cp_score == 0.0, (
        f"Old cross-platform activity must not count toward CP, got {old.cp_score}"
    )
    assert new.cp_score > 0.0, (
        f"Recent cross-platform activity should count toward CP, got {new.cp_score}"
    )
    assert new.cp_score > mid.cp_score, (
        f"More recent platforms should rank higher on CP (new={new.cp_score}, mid={mid.cp_score})"
    )


# ── 10. Empty DB is safe ───────────────────────────────────────────────────────

def test_recompute_empty_db(db_session):
    """recompute_rankings on an empty database should not raise and return a timestamp."""
    # db_session from conftest seeds two films but no mentions/daily scores
    snap = recompute_rankings(db_session)
    assert snap is not None
