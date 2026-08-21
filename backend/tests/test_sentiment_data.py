"""Tests for sentiment data in film detail responses."""
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Film, Ranking, Mention, Source


def _setup_with_mentions():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()

    f = Film(slug="test-film", title="Test Film", director="Test Director", year=2025)
    session.add(f)
    session.commit()

    snap = datetime.now(timezone.utc)
    r = Ranking(film_id=f.id, snapshot_at=snap, rank=1, score=85.0)
    session.add(r)
    session.commit()

    src = Source(key="reddit", name="Reddit", weight=1.0)
    session.add(src)
    session.commit()

    # Add 10 mentions: 6 positive, 2 neutral, 2 negative
    for i in range(10):
        label = "positive" if i < 6 else ("neutral" if i < 8 else "negative")
        score = 0.8 if label == "positive" else (-0.7 if label == "negative" else 0.0)
        m = Mention(
            film_id=f.id, source_id=src.id, external_id=f"ext_{i}",
            text=f"Mention {i}", sentiment_score=score, sentiment_label=label,
            engagement=5, created_at=snap,
        )
        session.add(m)
    session.commit()

    return engine, session


def test_film_detail_has_sufficient_sentiment_data():
    engine, session = _setup_with_mentions()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/films/test-film")
            assert response.status_code == 200
            data = response.json()
            sentiment = data["sentiment"]
            assert sentiment["sufficient_data"] is True
            assert sentiment["positive"] is not None
            assert sentiment["neutral"] is not None
            assert sentiment["negative"] is not None
            # Verify percentages add up to ~100
            total = sentiment["positive"] + sentiment["neutral"] + sentiment["negative"]
            assert abs(total - 100.0) < 1.0
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_film_detail_insufficient_data():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()

    f = Film(slug="no-data-film", title="No Data Film", year=2025)
    session.add(f)
    session.commit()

    snap = datetime.now(timezone.utc)
    r = Ranking(film_id=f.id, snapshot_at=snap, rank=1, score=50.0)
    session.add(r)
    session.commit()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/films/no-data-film")
            assert response.status_code == 200
            data = response.json()
            sentiment = data["sentiment"]
            assert sentiment["sufficient_data"] is False
            assert sentiment["positive"] is None
            # mentions_total should be 0, not fabricated
            assert data["mentions_total"] == 0
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
