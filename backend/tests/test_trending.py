"""Tests for trending endpoint."""
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Film, Ranking, Mention, Source


def _setup_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()

    f1 = Film(slug="film-a", title="Film A", director="Director A", year=2025)
    f2 = Film(slug="film-b", title="Film B", director="Director B", year=2025)
    session.add_all([f1, f2])
    session.commit()

    snap = datetime.now(timezone.utc)
    r1 = Ranking(film_id=f1.id, snapshot_at=snap, rank=1, score=98.0, movement=12)
    r2 = Ranking(film_id=f2.id, snapshot_at=snap, rank=2, score=85.0, movement=1)
    session.add_all([r1, r2])
    session.commit()

    src = Source(key="reddit", name="Reddit", weight=1.0)
    session.add(src)
    session.commit()

    # Add mentions for film A (high engagement)
    for i in range(5):
        m = Mention(
            film_id=f1.id, source_id=src.id, external_id=f"ext_{i}",
            text="Great film!", sentiment_score=0.8, sentiment_label="positive",
            engagement=10, created_at=snap,
        )
        session.add(m)
    session.commit()

    return engine, session_factory, session


def test_trending_films_returns_data():
    engine, session_factory, session = _setup_db()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/trending/films?limit=10")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            # Film A should be first (higher score * mentions)
            assert data[0]["film_slug"] == "film-a"
            assert data[0]["mentions_24h"] == 5
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_trend_reason_derived_from_signals():
    engine, session_factory, session = _setup_db()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/trending/films?limit=10")
            data = response.json()
            # Film A has movement=12 (>=10), so reason should reflect that
            film_a = next(f for f in data if f["film_slug"] == "film-a")
            assert "surg" in film_a["trend_reason"].lower() or "high" in film_a["trend_reason"].lower()
            # Tags should include #climbing or #viral given movement=12
            assert any(t in film_a["tags"] for t in ["#climbing", "#viral", "#highengagement"])
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_empty_when_no_data():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/trending/films?limit=10")
            assert response.status_code == 200
            assert response.json() == []
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
