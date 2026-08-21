"""Pytest configuration and shared fixtures."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Film, Ranking
from app.config import settings

# Tests must never hit the live TMDB API: the app's startup lifespan triggers a
# catalog sync whenever a key is present, which hangs the suite on slow upstream
# calls. Seed data + in-memory SQLite is all the tests need.
settings.tmdb_api_key = ""


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    # Seed test data
    f1 = Film(slug="mickey-17", title="Mickey 17", director="Bong Joon-ho", year=2025)
    f2 = Film(slug="superman", title="Superman", director="James Gunn", year=2025)
    session.add_all([f1, f2])
    session.commit()

    r1 = Ranking(id=1, snapshot_at=f1.created_at, film_id=f1.id, rank=1, score=98.5)
    r2 = Ranking(id=2, snapshot_at=f2.created_at, film_id=f2.id, rank=2, score=95.0)
    session.add_all([r1, r2])
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
