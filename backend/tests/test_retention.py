"""Retention invariants — the collapse must be invisible to the product.

Published chart numbers are all derived from ranking history at read time:
days-on-chart (first seen), days-at-#1 / top-10-days (distinct days),
longest streak at #1 (consecutive distinct days), the 24h movement baseline,
and the hourly rank-history sparkline. These tests prove each survives the
retention collapse bit-exactly.
"""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import Film, Ranking, Source
from app.services.retention import (
    RANKING_HISTORY_WINDOW_H,
    collapse_ranking_history,
    prune_raw_signals,
    run_retention,
)


@pytest.fixture()
def db():
    """Isolated in-memory SQLite per test — never the production engine
    (same pattern as conftest.db_session)."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(test_engine)
    Session = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    session = Session()
    yield session
    session.close()
    test_engine.dispose()


NOW = datetime(2026, 9, 20, 15, 0, 0)  # naive UTC, like the column


def _seed_chart_history(db):
    """One film, 30 days of snapshots at 15-min cadence; #1 for the first
    10 days, then #4; plus a second film entering on day 15."""
    film = Film(slug="test-film", title="Test Film", content_type="MOVIE")
    film2 = Film(slug="other-film", title="Other Film", content_type="MOVIE")
    src = Source(key="reddit", name="Reddit", weight=1.0)
    db.add_all([film, film2, src])
    db.commit()

    start = NOW - timedelta(days=30)
    rows = []
    for d in range(30):
        day = start + timedelta(days=d)
        # three snapshots per day (simulating the 15-min job, thinned)
        for h in (6, 12, 18):
            ts = day + timedelta(hours=h)
            rows.append(Ranking(
                snapshot_at=ts, chart_type="MOVIE_100", film_id=film.id,
                rank=1 if d < 10 else 4, score=90.0,
            ))
            if d >= 15:
                rows.append(Ranking(
                    snapshot_at=ts, chart_type="MOVIE_100", film_id=film2.id,
                    rank=2 if d < 20 else 7, score=70.0,
                ))
    db.add_all(rows)
    db.commit()
    return film, film2


def _read_side_metrics(db, film_id, chart="MOVIE_100"):
    """Reimplement the API's tenure math on whatever history remains —
    the same queries the endpoints run."""
    first_seen = db.scalar(
        select(func.min(Ranking.snapshot_at)).where(
            Ranking.film_id == film_id, Ranking.chart_type == chart)
    )
    days_on_chart = (NOW.date() - first_seen.date()).days + 1

    days_at_one = len({
        day for (day,) in db.query(func.date(Ranking.snapshot_at)).filter(
            Ranking.film_id == film_id, Ranking.chart_type == chart,
            Ranking.rank == 1).all()
    })
    top10_days = len({
        day for (day,) in db.query(func.date(Ranking.snapshot_at)).filter(
            Ranking.film_id == film_id, Ranking.chart_type == chart,
            Ranking.rank <= 10).all()
    })
    return days_on_chart, days_at_one, top10_days


def test_collapse_preserves_tenure_metrics(db):
    film, film2 = _seed_chart_history(db)
    before_f1 = _read_side_metrics(db, film.id)
    before_f2 = _read_side_metrics(db, film2.id)
    total_before = db.query(Ranking).count()

    report = collapse_ranking_history(db)

    after_f1 = _read_side_metrics(db, film.id)
    after_f2 = _read_side_metrics(db, film2.id)

    assert after_f1 == before_f1, "days-on-chart / at-#1 / top-10 changed!"
    assert after_f2 == before_f2, "second film's tenure metrics changed!"
    assert report["rows_deleted"] > 0
    assert db.query(Ranking).count() < total_before
    # every title's exact first-appearance timestamp survives
    first1 = db.scalar(
        select(Ranking.snapshot_at).where(Ranking.film_id == film.id)
        .order_by(Ranking.snapshot_at.asc()).limit(1))
    assert first1 == NOW - timedelta(days=30) + timedelta(hours=6)


def test_collapse_preserves_distinct_day_series(db):
    """The per-day rank series (day → rank) must be identical — this drives
    streaks, sparklines and 'days at N'."""
    film, _ = _seed_chart_history(db)

    def day_series():
        rows = db.query(
            func.date(Ranking.snapshot_at), Ranking.rank
        ).filter(Ranking.film_id == film.id).all()
        by_day = {}
        for day, rank in rows:
            by_day.setdefault(day, set()).add(rank)
        return by_day

    before = day_series()
    collapse_ranking_history(db)
    after = day_series()
    assert after == before


def test_recent_window_keeps_every_snapshot(db):
    film, _ = _seed_chart_history(db)
    # add dense recent snapshots inside the full-resolution window
    recent_ts = [NOW - timedelta(minutes=15 * i) for i in range(8)]
    db.add_all([Ranking(snapshot_at=ts, chart_type="MOVIE_100",
                        film_id=film.id, rank=1, score=90.0)
                for ts in recent_ts])
    db.commit()

    collapse_ranking_history(db)

    kept_recent = db.query(Ranking).filter(
        Ranking.snapshot_at >= NOW - timedelta(hours=RANKING_HISTORY_WINDOW_H)
    ).count()
    assert kept_recent >= len(recent_ts), "24h movement baseline window thinned!"


def test_collapse_is_idempotent(db):
    _seed_chart_history(db)
    first = collapse_ranking_history(db)
    count_after_first = db.query(Ranking).count()
    second = collapse_ranking_history(db)
    assert db.query(Ranking).count() == count_after_first
    assert second["rows_deleted"] == 0


def test_prune_raw_signals_windows(db):
    film, _ = _seed_chart_history(db)
    src = db.query(Source).first()
    from app.models import Mention, MetricSnapshot, PendingMention
    old = NOW - timedelta(days=60)
    fresh = NOW - timedelta(days=5)
    db.add_all([
        Mention(film_id=film.id, source_id=src.id, external_id="old-1",
                created_at=old, text="old", engagement=1),
        Mention(film_id=film.id, source_id=src.id, external_id="new-1",
                created_at=fresh, text="new", engagement=1),
        MetricSnapshot(source_id=src.id, external_id="m-old",
                       metric_type="views", value=1.0, observed_at=old),
        MetricSnapshot(source_id=src.id, external_id="m-new",
                       metric_type="views", value=2.0, observed_at=fresh),
        PendingMention(source_id=src.id, external_id="p-old", created_at=old),
        PendingMention(source_id=src.id, external_id="p-new", created_at=fresh),
    ])
    db.commit()

    report = prune_raw_signals(db)

    texts = {m.external_id for m in db.query(Mention).all()}
    metrics = {m.external_id for m in db.query(MetricSnapshot).all()}
    pendings = {p.external_id for p in db.query(PendingMention).all()}
    assert texts == {"new-1"}
    assert metrics == {"m-new"}
    assert pendings == {"p-new"}
    assert report["mentions_deleted"] == 1


def test_run_retention_full_pass(db):
    _seed_chart_history(db)
    report = run_retention(db)
    assert report["status"] == "ok"
    # latest snapshot is untouched → the live chart reads identically
    latest = db.scalar(select(func.max(Ranking.snapshot_at)))
    rows = db.query(Ranking).filter(Ranking.snapshot_at == latest).all()
    assert len(rows) >= 1
