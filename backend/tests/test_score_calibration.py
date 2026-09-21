"""Score recalibration tests — the Index Score is an ABSOLUTE attention scale.

The old map, score = 100·(1 − exp(−3·composite/p95)), anchored on the pool's
own p95 composite: the 95th-percentile title was pinned to ≈95.0 every cycle,
so a quiet week and a blockbuster week rendered identically and the whole
chart collapsed into a ~3-point band (production: #1 96.10 → #100 93.18).

The new map, score = 100·log10(1+A)/log10(1+A_ref), uses each title's own
decay-weighted attention intensity A. These tests lock in the properties the
product requires:

  1. no compression — a 50× volume spread renders a wide score spread
  2. volume sensitivity — 10× more attention moves scores up (the old map was
     invariant to uniform scaling)
  3. calibration contract — score ↔ attention_raw match the map exactly
  4. displayed scores never increase down the published order
  5. a quiet pool's #1 scores far below a blockbuster pool's #1
  6. no saturation plateau near the top
  7. attention_raw is persisted for audit on every row

Steady-N-mentions-on-one-day pools give A = N exactly (single-day window,
λ^0 weight), which makes the expected scores computable by hand.
"""
import math

import pytest

from app.config import settings
from app.models import Ranking
from app.services.display_calibration import beta_display_score
from app.services.ranking import recompute_rankings


A_REF = settings.score_attention_ref


def _expected_score(a: float) -> float:
    # Mirrors the production map including its clamp at 100 and the beta
    # display calibration (identity when the flag is off).
    if a <= 0.0:
        return 0.0
    raw = min(100.0, 100.0 * math.log10(1.0 + a) / math.log10(1.0 + A_REF))
    return beta_display_score(raw)


def _add_source(db, key="test"):
    from app.models import Source
    src = Source(key=key, name="Test Source", weight=1.0)
    db.add(src)
    db.commit()
    db.refresh(src)
    return src


def _add_film(db, slug, title):
    from app.models import Film
    f = Film(slug=slug, title=title, year=2025)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def _add_mentions(db, film_id, source_id, n, suffix=""):
    from app.models import Mention
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    for j in range(n):
        db.add(Mention(
            film_id=film_id,
            source_id=source_id,
            external_id=f"cal-{film_id}-{suffix}-{j}",
            engagement=10,
            created_at=now - timedelta(minutes=5 + j),
        ))
    db.commit()


def _rows_for_snapshot(db, snap):
    return (
        db.query(Ranking)
        .filter(Ranking.snapshot_at == snap)
        .order_by(Ranking.rank.asc())
        .all()
    )


# ── 1. the compression guard ─────────────────────────────────────────────────

def test_no_score_compression_across_wide_volume_spread(db_session):
    """A 50× volume spread between #1 and the tail must render a wide score
    spread. The old p95 map rendered this pool as ~93–96 (2.9 points)."""
    src = _add_source(db_session)
    volumes = [250, 50, 10, 3, 1]
    films = []
    for i, n in enumerate(volumes):
        f = _add_film(db_session, f"spread-{i}", f"Spread {i}")
        _add_mentions(db_session, f.id, src.id, n, suffix=f"s{i}")
        films.append((f, n))
    db_session.commit()

    snap = recompute_rankings(db_session)
    rows = _rows_for_snapshot(db_session, snap)
    assert len(rows) == 5

    scores = [r.score for r in rows]
    spread = max(scores) - min(scores)
    assert spread > 25.0, (
        "score compression regression: a 50× attention spread rendered as "
        f"{spread:.2f} points (scores: {scores})"
    )


# ── 2. volume sensitivity ────────────────────────────────────────────────────

def test_uniform_volume_scaling_moves_scores(db_session):
    """10× more measured attention must move scores UP. The old p95 map was
    invariant to uniform scaling (anchor scaled with the pool)."""
    src = _add_source(db_session)

    small = _add_film(db_session, "scale-small", "Small Pool Leader")
    _add_mentions(db_session, small.id, src.id, 5, suffix="sm")

    snap_a = recompute_rankings(db_session)
    top_a = _rows_for_snapshot(db_session, snap_a)[0]

    big = _add_film(db_session, "scale-big", "Big Pool Leader")
    _add_mentions(db_session, big.id, src.id, 50, suffix="bg")

    snap_b = recompute_rankings(db_session)
    rows_b = {r.film_id: r for r in _rows_for_snapshot(db_session, snap_b)}
    top_b = rows_b[big.id]

    # 10× attention → clearly higher absolute score.
    assert top_b.score - top_a.score > 30.0, (
        f"uniform scaling did not move scores: small={top_a.score}, big={top_b.score}"
    )
    # A 5-mentions/day leader is NOT "exceptional" — it must not sit in the
    # 90s. Holds for any sane anchor (score_attention_ref ≥ 10).
    assert top_a.score < 70.0


# ── 3. calibration contract: score ↔ attention_raw ──────────────────────────

def test_score_matches_absolute_map_of_attention_raw(db_session):
    """Every persisted score must equal the absolute map of its persisted
    attention_raw (A = A_ref → 100; A = A_ref/2 → ~79.2; monotone in A)."""
    src = _add_source(db_session)
    volumes = [100, 20, 5]
    for i, n in enumerate(volumes):
        f = _add_film(db_session, f"cal-{i}", f"Cal {i}")
        _add_mentions(db_session, f.id, src.id, n, suffix=f"c{i}")

    snap = recompute_rankings(db_session)
    rows = _rows_for_snapshot(db_session, snap)

    for r in rows:
        expected = _expected_score(r.attention_raw)
        assert r.score == pytest.approx(expected, abs=0.6), (
            f"score {r.score} != map(attention_raw={r.attention_raw}) = {expected}"
        )

    # Map anchors (in raw-map space): A = A_ref → 100; A = 0 → 0; monotone in
    # A; clamped at the top (100× the reference saturates at 100). With the
    # beta calibration on, the published score is the band-stretched value.
    assert _expected_score(A_REF) == pytest.approx(beta_display_score(100.0))
    assert _expected_score(0.0) == 0.0
    assert _expected_score(1.0) < _expected_score(10.0) < _expected_score(100.0)
    assert _expected_score(A_REF * 100) == pytest.approx(beta_display_score(100.0))


# ── 4. presentation monotonicity ─────────────────────────────────────────────

def test_displayed_scores_never_increase_down_the_chart(db_session):
    """Rank is composite order; score is absolute attention. Whatever the
    pool, published scores must be non-increasing from #1 down."""
    src = _add_source(db_session)
    volumes = [40, 35, 30, 12, 6, 2]
    for i, n in enumerate(volumes):
        f = _add_film(db_session, f"mono-{i}", f"Mono {i}")
        _add_mentions(db_session, f.id, src.id, n, suffix=f"m{i}")

    snap = recompute_rankings(db_session)
    rows = _rows_for_snapshot(db_session, snap)
    scores = [r.score for r in rows]
    for prev, cur in zip(scores, scores[1:]):
        assert cur <= prev + 1e-9, f"score increased down the chart: {scores}"


# ── 5. quiet week vs blockbuster week ────────────────────────────────────────

def test_quiet_week_top_score_below_blockbuster_week(db_session):
    """The same chart structure in a quiet week must score lower than in a
    blockbuster week — the score measures attention, not chart position."""
    src = _add_source(db_session)

    quiet = _add_film(db_session, "quiet-1", "Quiet Week Leader")
    _add_mentions(db_session, quiet.id, src.id, 1, suffix="q")

    snap_q = recompute_rankings(db_session)
    top_q = _rows_for_snapshot(db_session, snap_q)[0]
    assert top_q.score < 50.0, (
        f"quiet-week #1 scored {top_q.score} — should not read as exceptional"
    )

    hit = _add_film(db_session, "hit-1", "Blockbuster Leader")
    _add_mentions(db_session, hit.id, src.id, 30, suffix="h")
    rival = _add_film(db_session, "hit-2", "Blockbuster Rival")
    _add_mentions(db_session, rival.id, src.id, 12, suffix="h2")

    snap_b = recompute_rankings(db_session)
    rows_b = {r.film_id: r for r in _rows_for_snapshot(db_session, snap_b)}
    top_b = rows_b[hit.id]

    # Anchor-free expectations: the blockbuster #1 must match the absolute
    # map of its own measured attention (consistency), and must dominate the
    # quiet-week #1 by a wide margin (the score reflects attention, not rank).
    assert top_b.score == pytest.approx(_expected_score(30.0), abs=1.0)
    assert top_b.score > top_q.score + 25.0


# ── 6. no saturation plateau ─────────────────────────────────────────────────

def test_no_saturation_plateau_at_the_top(db_session, monkeypatch):
    """A 10× attention gap between #1 and #2 must stay clearly visible in the
    scores. The old exponential flattened such gaps into ~3 points everywhere;
    the log map preserves them across the scale's working range."""
    # This assertion is about the RAW map's shape; run with the calibration
    # off so the fixed band floor/ceiling cannot mask relative differences.
    monkeypatch.setattr(settings, "beta_display_calibration", False)
    src = _add_source(db_session)
    leader = _add_film(db_session, "sat-1", "Saturation Leader")
    _add_mentions(db_session, leader.id, src.id, 10, suffix="l1")
    second = _add_film(db_session, "sat-2", "Saturation Second")
    _add_mentions(db_session, second.id, src.id, 1, suffix="l2")

    snap = recompute_rankings(db_session)
    rows = _rows_for_snapshot(db_session, snap)
    top, second_row = rows[0], rows[1]
    gap = top.score - second_row.score
    assert gap > 10.0, (
        f"saturation regression: 10× attention gap rendered as {gap:.2f} points"
    )


# ── 7. attention_raw audit column ────────────────────────────────────────────

def test_attention_raw_persisted_on_every_row(db_session):
    src = _add_source(db_session)
    for i, n in enumerate([30, 7]):
        f = _add_film(db_session, f"aud-{i}", f"Audit {i}")
        _add_mentions(db_session, f.id, src.id, n, suffix=f"a{i}")

    snap = recompute_rankings(db_session)
    rows = _rows_for_snapshot(db_session, snap)
    for r in rows:
        assert r.attention_raw is not None
        assert r.attention_raw >= 0.0
        # Single-day pools: A equals the raw mention count for that day.
        assert r.attention_raw == pytest.approx(float(r.sample_size or 0), abs=1.0)
