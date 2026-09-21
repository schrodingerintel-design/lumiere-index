"""Observation-volume attention — A must read measured volume, not row count.

Production defect this locks in: Google Trends (and any aggregate source)
emits ONE Mention row per title per day carrying the real underlying volume
in ``observations`` (weekly search-interest units, YouTube views, pageviews).
The attention map consumed COUNT(rows), so every Trends-covered title scored
A = 1.0/day → an identical Index Score (production: six #1–#6 titles all at
21.27, and only 10 distinct scores across the whole Movie 100).

These tests pin the contract:

  1. observation volume differentiates scores where row counts tie
  2. the A ↔ score map still holds exactly under observation input
  3. per-item sources with observations=0 fall back to row counts (no
     regression for legacy rows)
  4. observation volume also drives the real-time Mention backstop path
  5. sample_size stays ROW-count based (evidence floor is about records, not
     volume) — deliberate separation of concerns
"""
import math

import pytest

from app.config import settings
from app.models import DailyScore, Mention, Ranking, Source
from app.services.ranking import recompute_rankings

A_REF = settings.score_attention_ref


def _score_of(a: float) -> float:
    if a <= 0.0:
        return 0.0
    return min(100.0, 100.0 * math.log10(1.0 + a) / math.log10(1.0 + A_REF))


def _add_source(db, key="trends"):
    src = Source(key=key, name=key.title(), weight=1.0)
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


def _rows(db, snap):
    return db.query(Ranking).filter(Ranking.snapshot_at == snap).order_by(Ranking.rank.asc()).all()


def test_observation_volume_differentiates_identical_row_counts(db_session):
    """Two titles, ONE mention row each today — but wildly different
    observation volumes. Row-count attention would score them identically;
    observation-based attention must separate them by the volume gap."""
    src = _add_source(db_session)

    quiet = _add_film(db_session, "obs-quiet", "Obs Quiet")
    hit = _add_film(db_session, "obs-hit", "Obs Hit")
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    db_session.add(Mention(
        film_id=quiet.id, source_id=src.id, external_id="oq-1",
        engagement=10, observations=1, created_at=now,
    ))
    # A blockbuster-level aggregate row: one record, high volume.
    db_session.add(Mention(
        film_id=hit.id, source_id=src.id, external_id="oh-1",
        engagement=10, observations=15, created_at=now,
    ))
    db_session.commit()

    snap = recompute_rankings(db_session)
    rows = {r.film_id: r for r in _rows(db_session, snap)}

    assert rows[hit.id].attention_raw == pytest.approx(15.0, abs=0.5)
    assert rows[quiet.id].attention_raw == pytest.approx(1.0, abs=0.1)
    assert rows[hit.id].score == pytest.approx(_score_of(15.0), abs=0.6)
    assert rows[quiet.id].score == pytest.approx(_score_of(1.0), abs=0.6)
    # The volume gap must survive the map — no more flat 21.3 ties.
    assert rows[hit.id].score - rows[quiet.id].score > 20.0


def test_attention_raw_matches_observation_map_via_daily_scores(db_session):
    """The DailyScore path (post-rollup) must carry observation volume too."""
    src = _add_source(db_session)
    from datetime import date
    big = _add_film(db_session, "ds-big", "DS Big")
    small = _add_film(db_session, "ds-small", "DS Small")
    db_session.add(DailyScore(
        film_id=big.id, day=date.today(), mentions_count=1,
        observations_sum=500, sentiment_avg=0.0,
    ))
    db_session.add(DailyScore(
        film_id=small.id, day=date.today(), mentions_count=1,
        observations_sum=5, sentiment_avg=0.0,
    ))
    db_session.commit()

    snap = recompute_rankings(db_session)
    rows = {r.film_id: r for r in _rows(db_session, snap)}
    assert rows[big.id].attention_raw == pytest.approx(500.0, abs=1.0)
    assert rows[small.id].attention_raw == pytest.approx(5.0, abs=1.0)
    assert rows[big.id].score > rows[small.id].score + 30.0


def test_zero_observation_rows_fall_back_to_row_count(db_session):
    """Legacy per-item rows carry observations=0 (engagement-only). Their
    attention must still register — one row = one observation."""
    src = _add_source(db_session)
    f = _add_film(db_session, "legacy-rows", "Legacy Rows")
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    for j in range(7):
        db_session.add(Mention(
            film_id=f.id, source_id=src.id, external_id=f"lg-{j}",
            engagement=10, observations=0, created_at=now,
        ))
    db_session.commit()

    snap = recompute_rankings(db_session)
    row = _rows(db_session, snap)[0]
    assert row.attention_raw == pytest.approx(7.0, abs=1.0)
    assert row.score > 0.0


def test_sample_size_stays_row_based(db_session):
    """Evidence floor (sample_size/confidence) counts RECORDS — one aggregate
    row is one piece of evidence regardless of its volume. Only the attention
    intensity reads volume. Both matter; they answer different questions."""
    src = _add_source(db_session)
    f = _add_film(db_session, "evidence-1", "Evidence One")
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    db_session.add(Mention(
        film_id=f.id, source_id=src.id, external_id="ev-1",
        engagement=10, observations=999_999, created_at=now,
    ))
    db_session.commit()

    snap = recompute_rankings(db_session)
    row = _rows(db_session, snap)[0]
    # Volume drives attention…
    assert row.attention_raw == pytest.approx(999_999.0, abs=2.0)
    # …but evidence stays at one record.
    assert row.sample_size == 1


def test_realtime_backstop_path_carries_observations(db_session):
    """When DailyScore rows are absent (rollup lag), the direct Mention
    aggregation must supply observation volume identically."""
    src = _add_source(db_session)
    via_mention = _add_film(db_session, "rt-mention", "RT Mention")
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    db_session.add(Mention(
        film_id=via_mention.id, source_id=src.id, external_id="rt-1",
        engagement=10, observations=250, created_at=now,
    ))
    db_session.commit()

    snap = recompute_rankings(db_session)
    row = _rows(db_session, snap)[0]
    assert row.attention_raw == pytest.approx(250.0, abs=1.0)
    assert row.score == pytest.approx(_score_of(250.0), abs=0.6)
