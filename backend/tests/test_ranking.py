"""Tests for the ranking engine."""
from datetime import datetime, timedelta
from pytest import approx

from app.models import Film, Mention, Source, Ranking
from app.services.ranking import _time_decay, recompute_rankings


def test_time_decay_at_zero():
    assert _time_decay(0.0, 24.0) == 1.0


def test_time_decay_at_half_life():
    assert _time_decay(24.0, 24.0) == 0.5


def test_time_decay_at_double():
    assert _time_decay(48.0, 24.0) == 0.25


def test_recompute_rankings_empty_db(db_session):
    now = recompute_rankings(db_session)
    assert now is not None


def test_recompute_rankings_with_mentions(db_session):
    src = Source(key="test", name="Test", weight=1.0)
    db_session.add(src)
    db_session.commit()
    db_session.refresh(src)

    film = db_session.query(Film).first()

    for i in range(5):
        m = Mention(
            film_id=film.id, source_id=src.id,
            external_id=f"t{i}", url=None, author="tester",
            engagement=100 * (i + 1),
            created_at=datetime.utcnow() - timedelta(hours=i),
        )
        db_session.add(m)
    db_session.commit()

    now = recompute_rankings(db_session)
    rankings = db_session.query(Ranking).filter(Ranking.snapshot_at == now).all()
    assert len(rankings) == 1
    assert rankings[0].film_id == film.id
    assert rankings[0].score > 0
