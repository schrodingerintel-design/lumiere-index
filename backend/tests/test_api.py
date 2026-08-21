"""API integration tests for backend endpoints."""
from fastapi.testclient import TestClient


def test_health(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_top_films(client: TestClient):
    response = client.get("/api/v1/films/top?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["slug"] == "mickey-17"
    assert data[0]["rank"] == 1


def test_film_detail(client: TestClient):
    response = client.get("/api/v1/films/mickey-17")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Mickey 17"
    assert data["director"] == "Bong Joon-ho"


def test_film_detail_not_found(client: TestClient):
    response = client.get("/api/v1/films/non-existent-film")
    assert response.status_code == 404


def test_live_stats(client: TestClient):
    response = client.get("/api/v1/stats/live")
    assert response.status_code == 200
    data = response.json()
    assert "tracked_films" in data


def test_newsletter_subscribe(client: TestClient):
    response = client.post("/api/v1/newsletter/subscribe", json={"email": "cinephile@example.com"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_meta_sources_returns_known_sources(client: TestClient):
    response = client.get("/api/v1/meta/sources")
    assert response.status_code == 200
    data = response.json()
    keys = {s["key"] for s in data}
    assert {"reddit", "news", "youtube", "tmdb"}.issubset(keys)
    for s in data:
        assert "last_ingested_at" in s
        assert "last_error" in s
        assert "mentions_24h" in s
        assert "key_configured" in s
