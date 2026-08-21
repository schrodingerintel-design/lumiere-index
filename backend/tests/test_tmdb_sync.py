"""Tests for the TMDB catalog sync (upsert-by-tmdb_id, idempotency)."""
from datetime import datetime, timezone

from app.ingest import tmdb as tmdb_mod
from app.models import Film, Mention, Source

SAMPLE = [
    {
        "id": 1001, "title": "Galactic", "original_title": "Galactic",
        "release_date": "2025-06-01", "popularity": 99.0, "vote_average": 8.1,
        "vote_count": 1200, "overview": "A space epic.", "poster_path": "/abc.jpg",
        "backdrop_path": "/def.jpg", "origin_country": ["US"],
    },
    {
        "id": 1002, "title": "The Silent Tide", "original_title": "The Silent Tide",
        "release_date": "2025-09-15", "popularity": 88.0, "vote_average": 6.9,
        "vote_count": 400, "overview": "A coastal drama.", "poster_path": None,
        "backdrop_path": None, "origin_country": [],
    },
]


def _run_sync(db_session):
    return tmdb_mod.sync_tmdb_catalog(db_session, max_films=10)


def test_sync_tmdb_catalog_creates_films(db_session, monkeypatch):
    monkeypatch.setattr(tmdb_mod, "fetch_tmdb_movies", lambda key, pages: SAMPLE)
    monkeypatch.setattr(tmdb_mod, "fetch_movie_director", lambda key, id: "Test Director")
    monkeypatch.setattr(tmdb_mod, "recompute_rankings", lambda db: datetime.now(timezone.utc))

    films = _run_sync(db_session)
    assert len(films) == 2

    db_session.expire_all()
    f1 = db_session.query(Film).filter_by(title="Galactic").first()
    assert f1 is not None
    assert f1.tmdb_id == 1001
    assert f1.year == 2025
    assert f1.director == "Test Director"

    src = db_session.query(Source).filter_by(key="tmdb").first()
    assert src is not None
    assert src.last_ingested_at is not None

    assert db_session.query(Mention).filter_by(film_id=f1.id).count() >= 1


def test_sync_tmdb_catalog_is_idempotent(db_session, monkeypatch):
    monkeypatch.setattr(tmdb_mod, "fetch_tmdb_movies", lambda key, pages: SAMPLE)
    monkeypatch.setattr(tmdb_mod, "fetch_movie_director", lambda key, id: "Test Director")
    monkeypatch.setattr(tmdb_mod, "recompute_rankings", lambda db: datetime.now(timezone.utc))

    _run_sync(db_session)
    _run_sync(db_session)

    assert db_session.query(Film).filter(Film.tmdb_id.isnot(None)).count() == 2
    assert db_session.query(Mention).count() == 2


def test_sync_tmdb_catalog_backfills_legacy_row(db_session, monkeypatch):
    monkeypatch.setattr(tmdb_mod, "fetch_tmdb_movies", lambda key, pages: SAMPLE)
    monkeypatch.setattr(tmdb_mod, "fetch_movie_director", lambda key, id: "Test Director")
    monkeypatch.setattr(tmdb_mod, "recompute_rankings", lambda db: datetime.now(timezone.utc))

    legacy = Film(slug="galactic", title="Galactic", director="Old Director", year=2024)
    db_session.add(legacy)
    db_session.commit()
    legacy_id = legacy.id

    _run_sync(db_session)

    db_session.expire_all()
    row = db_session.get(Film, legacy_id)
    assert row.tmdb_id == 1001
    assert db_session.query(Film).filter_by(tmdb_id=1001).count() == 1
    assert db_session.query(Film).filter_by(tmdb_id=1002).count() == 1
