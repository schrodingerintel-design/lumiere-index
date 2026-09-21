"""Beta display calibration — the presentation band contract.

During the public beta the absolute attention map renders the chart low (one
live source, chunk-relative data), so published scores are stretched into the
band the beta chart is designed around: strongest measured attention ≈ 98.5
(ceiling), chart bottom ≈ 26 (floor), every real attention gap preserved
proportionally. The transform is a FIXED monotone stretch of the absolute
score — never rank-derived, never pool-relative.

Contract locked here:

  1. ceiling: the strongest attention on the chart reads ≈ the ceiling
  2. floor: minimal attention reads ≈ the floor, never below
  3. proportional: real gaps scale with the stretch, ties stay ties
  4. bounded: no displayed score can ever exceed the ceiling (the old
     frontend-side rescale produced 844.8)
  5. reversible: flag off → raw absolute map returns exactly
  6. daily and weekly engines stay on one scale
"""
import math

import pytest

from app.config import settings
from app.models import Ranking
from app.services.display_calibration import beta_display_score
from app.services.ranking import recompute_rankings


FLOOR = settings.beta_display_floor
CEILING = settings.beta_display_ceiling


def _raw_score(a: float) -> float:
    if a <= 0.0:
        return 0.0
    return min(100.0, 100.0 * math.log10(1.0 + a) / math.log10(1.0 + settings.score_attention_ref))


def _add_source(db, key="band"):
    from app.models import Source
    src = Source(key=key, name="Band Source", weight=1.0)
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


def _add_mentions(db, film_id, source_id, n, suffix="", age_minutes=5):
    from app.models import Mention
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    for j in range(n):
        db.add(Mention(
            film_id=film_id,
            source_id=source_id,
            external_id=f"band-{film_id}-{suffix}-{j}",
            engagement=10,
            created_at=now - timedelta(minutes=age_minutes + j),
        ))
    db.commit()


def _rows(db, snap):
    return db.query(Ranking).filter(Ranking.snapshot_at == snap).order_by(Ranking.rank.asc()).all()


# ── 1+2. band endpoints on a live chart ─────────────────────────────────────

def test_band_endpoints_on_a_real_chart(db_session):
    """The chart's strongest title lands at the ceiling; a minimal-attention
    title lands near the floor — while #100 is well above the raw map's
    near-zero rendering (the whole point of the band)."""
    src = _add_source(db_session)
    leader = _add_film(db_session, "band-lead", "Band Leader")
    _add_mentions(db_session, leader.id, src.id, 120, suffix="L")  # ≥ A_ref → raw 100
    # Chart-bottom title: one mention three weeks old → decayed attention ≈ 0
    # (λ^21 ≈ 0.08), the production shape of a #100 row.
    tail = _add_film(db_session, "band-tail", "Band Tail")
    _add_mentions(db_session, tail.id, src.id, 1, suffix="T", age_minutes=21 * 24 * 60)

    snap = recompute_rankings(db_session)
    rows = _rows(db_session, snap)
    top, bottom = rows[0], rows[-1]

    assert top.score == pytest.approx(CEILING, abs=0.6), (
        f"chart leader scored {top.score}, expected the ceiling {CEILING}"
    )
    # The tail sits close to the floor (its raw score is small but nonzero).
    assert FLOOR <= bottom.score <= FLOOR + 5.0, (
        f"chart tail scored {bottom.score}, expected ≈ floor {FLOOR}"
    )
    # And the band actually widens the presentation: bottom ≥ 26 while the
    # raw map would render the same title near the bottom of the scale.
    assert bottom.score > _raw_score(bottom.attention_raw) + 10.0


# ── 3. proportional gaps + ties ──────────────────────────────────────────────

def test_gaps_scale_proportionally_and_ties_stay_ties(db_session):
    """The stretch multiplies every raw difference by (ceiling−floor)/100:
    relative gaps survive, equal attention still displays equal."""
    a = beta_display_score(80.0)
    b = beta_display_score(40.0)
    c = beta_display_score(40.0)

    # Proportional: display(2x) − display(x) == (ceiling−floor)·x/100.
    assert (a - b) == pytest.approx((CEILING - FLOOR) * 40.0 / 100.0, abs=0.02)
    # Ties stay ties.
    assert b == c
    # Monotone in raw attention.
    assert a > b
    # Endpoints: raw 100 → ceiling, raw →0 → floor-ish, zero stays zero.
    assert beta_display_score(100.0) == pytest.approx(CEILING, abs=0.01)
    assert beta_display_score(0.0) == 0.0


# ── 4. bounded — the 844.8 class of bug cannot recur ────────────────────────

def test_display_scores_never_exceed_the_ceiling(db_session):
    """Whatever the rank/score disagreement below #1, no published score may
    exceed the ceiling. (The removed frontend rescale produced 844.8.)"""
    src = _add_source(db_session)
    quiet_leader = _add_film(db_session, "cap-quiet", "Quiet Composite Leader")
    _add_mentions(db_session, quiet_leader.id, src.id, 2, suffix="q")
    loud = _add_film(db_session, "cap-loud", "Loud Volume Title")
    _add_mentions(db_session, loud.id, src.id, 120, suffix="l")

    snap = recompute_rankings(db_session)
    rows = _rows(db_session, snap)
    for r in rows:
        assert 0.0 <= r.score <= CEILING + 1e-9, (
            f"{r.title if hasattr(r, 'title') else r.film_id}: score {r.score} outside [0, {CEILING}]"
        )
    # The louder title's score is the ceiling even though composite ordering
    # may rank it below the quiet leader — the score keeps its own truth.
    by_fid = {r.film_id: r for r in rows}
    assert by_fid[loud.id].score == pytest.approx(CEILING, abs=0.6)


# ── 5. reversibility at normal launch ───────────────────────────────────────

def test_flag_off_returns_the_raw_absolute_map(db_session, monkeypatch):
    """Flipping the calibration off must restore the untouched absolute
    attention map — the normal-launch behavior, bit for bit."""
    monkeypatch.setattr(settings, "beta_display_calibration", False)

    assert beta_display_score(73.4) == 73.4
    assert beta_display_score(100.0) == 100.0
    assert beta_display_score(0.0) == 0.0

    src = _add_source(db_session)
    for i, n in enumerate([30, 5]):
        f = _add_film(db_session, f"rev-{i}", f"Raw {i}")
        _add_mentions(db_session, f.id, src.id, n, suffix=f"r{i}")
    snap = recompute_rankings(db_session)
    for r in _rows(db_session, snap):
        assert r.score == pytest.approx(_raw_score(r.attention_raw), abs=0.05), (
            f"flag-off score {r.score} != raw map {_raw_score(r.attention_raw)}"
        )


# ── 6. daily and weekly share one scale ─────────────────────────────────────

def test_weekly_publisher_uses_the_same_band(db_session, monkeypatch):
    """The weekly publisher's _absolute_scores must pass through the same
    calibration so a weekly score and a daily score are comparable."""
    from app.services.index_publication import _absolute_scores

    monkeypatch.setattr(settings, "beta_display_calibration", True)
    out = _absolute_scores({1: 100.0})
    assert out[1] == pytest.approx(CEILING, abs=0.01)

    monkeypatch.setattr(settings, "beta_display_calibration", False)
    out_off = _absolute_scores({1: 100.0})
    assert out_off[1] == pytest.approx(100.0, abs=0.01)
