"""Tests for rate limiting middleware."""
import time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.api.v1.newsletter import reset_rate_store
from app.utils.rate_limit import SimpleRateLimiterMiddleware


def test_rate_limit_allows_within_threshold():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            # Make a few requests (well under 120 RPM)
            for _ in range(5):
                response = client.get("/health")
                assert response.status_code == 200
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_newsletter_rate_limit():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        SimpleRateLimiterMiddleware.reset_all()
        reset_rate_store()
        with TestClient(app) as client:
            # First 3 should succeed
            for i in range(3):
                response = client.post(
                    "/api/v1/newsletter/subscribe",
                    json={"email": f"test{i}@example.com"},
                )
                assert response.status_code == 200

            # 4th should be rate limited
            response = client.post(
                "/api/v1/newsletter/subscribe",
                json={"email": "test3@example.com"},
            )
            assert response.status_code == 429
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
