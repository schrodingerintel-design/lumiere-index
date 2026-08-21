"""Tests for film search endpoint."""
from fastapi.testclient import TestClient


def test_search_films(client: TestClient):
    response = client.get("/api/v1/films/search?q=mickey")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["title"] == "Mickey 17"


def test_search_films_case_insensitive(client: TestClient):
    response = client.get("/api/v1/films/search?q=MICKEY")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_search_films_no_results(client: TestClient):
    response = client.get("/api/v1/films/search?q=nonexistent")
    assert response.status_code == 200
    data = response.json()
    assert data == []


def test_search_films_requires_query(client: TestClient):
    response = client.get("/api/v1/films/search")
    assert response.status_code == 422


def test_search_films_partial_match(client: TestClient):
    response = client.get("/api/v1/films/search?q=super")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["slug"] == "superman"
