"""Tests for the TMDB catalog sync — catalog-only, both content types.

Critical invariant: TMDB is a metadata provider, NOT a signal. The sync must
NEVER create Mention rows, and nothing downstream may count them as signals.
"""
from datetime import datetime, timezone

from app.ingest import tmdb as tmdb_mod
from app.models import Film, Mention, Source

MOVIE_SAMPLE = [
    {
        "id": 1001, "title": "Galactic", "original_title": "Galactic",
        "release_date": "2025-06-01", "popularity": 99.0, "vote_average": 8.1,
        "vote_count": 1200, "overview": "A space epic.", "poster_path": "/abc.jpg",
        "backdrop_path": "/def.jpg", "origin_country": ["US"],
        "genre_ids": [878],  # Sci-Fi
    },
    {
        "id": 1002, "title": "The Silent Tide", "original_title": "The Silent Tide",
        "release_date": "2025-09-15", "popularity": 88.0, "vote_average": 6.9,
        "vote_count": 400, "overview": "A coastal drama.", "poster_path": None,
        "backdrop_path": None, "origin_country": [],
        "genre_ids": [18],  # Drama
    },
]

TV_SAMPLE = [
    {
        "id": 5001, "name": "Starfall", "original_name": "Starfall",
        "first_air_date": "2025-04-10", "popularity": 120.0, "vote_average": 7.5,
        "vote_count": 900, "overview": "A serialized space saga.", "poster_path": "/tv.jpg",
        "backdrop_path": "/tv-bg.jpg", "origin_country": ["US"],
        "genre_ids": [10765],  # Sci-Fi & Fantasy (TV id space)
    },
    {
        "id": 5002, "name": "Ashgrove", "original_name": "Ashgrove",
        "first_air_date": "2025-08-01", "popularity": 70.0, "vote_average": 6.2,
        "vote_count": 300, "overview": "A slow-burn mystery.", "poster_path": None,
        "backdrop_path": None, "origin_country": ["GB"],
        "genre_ids": [9648],  # Mystery (TV)
    },
]


def _run_sync(db_session, content_type="MOVIE"):
    return tmdb_mod.sync_tmdb_catalog(db_session, max_films=10, content_type=content_type)


def _patch_movie_fetch(monkeypatch):
    monkeypatch.setattr(tmdb_mod, "fetch_tmdb_movies", lambda key, pages: MOVIE_SAMPLE)
    monkeypatch.setattr(tmdb_mod, "fetch_movie_director", lambda key, id: "Test Director")
    monkeypatch.setattr(tmdb_mod, "recompute_rankings", lambda db: datetime.now(timezone.utc))


def _patch_tv_fetch(monkeypatch):
    monkeypatch.setattr(tmdb_mod, "fetch_tmdb_tv", lambda key, pages: TV_SAMPLE)
    monkeypatch.setattr(tmdb_mod, "fetch_tv_creator", lambda key, id: "Test Creator")
    monkeypatch.setattr(tmdb_mod, "recompute_rankings", lambda db: datetime.now(timezone.utc))


# ── the firewall ─────────────────────────────────────────────────────────────

def test_sync_tmdb_catalog_creates_films(db_session, monkeypatch):
    _patch_movie_fetch(monkeypatch)
    films = _run_sync(db_session)
    assert len(films) == 2

    db_session.expire_all()
    f1 = db_session.query(Film).filter_by(title="Galactic").first()
    assert f1 is not None
    assert f1.tmdb_id == 1001
    assert f1.content_type == "MOVIE"
    assert f1.year == 2025
    assert f1.director == "Test Director"
    assert f1.genre_tag == "Sci-Fi"


def test_tmdb_sync_never_creates_mentions(db_session, monkeypatch):
    """THE FIREWALL: TMDB catalog sync must produce ZERO signal rows.

    TMDB popularity/votes are metadata, not cultural attention. If a TMDB
    sync ever writes a Mention row, TMDB data flows into the Index Score —
    a direct violation of the ranking architecture.
    """
    _patch_movie_fetch(monkeypatch)
    _run_sync(db_session)
    _run_sync(db_session)  # second run — including updates — must stay clean

    assert db_session.query(Mention).count() == 0


def test_tmdb_tv_sync_never_creates_mentions(db_session, monkeypatch):
    _patch_tv_fetch(monkeypatch)
    _run_sync(db_session, content_type="TV_SHOW")
    assert db_session.query(Mention).count() == 0


def test_tmdb_source_tracked_but_signalless(db_session, monkeypatch):
    """The tmdb Source row may exist for health tracking, but it must carry
    no mention rows — coverage/rollup/ranking exclude it defensively."""
    _patch_movie_fetch(monkeypatch)
    _run_sync(db_session)

    src = db_session.query(Source).filter_by(key="tmdb").first()
    if src is not None:
        assert db_session.query(Mention).filter_by(source_id=src.id).count() == 0


# ── idempotency & identity ──────────────────────────────────────────────────

def test_sync_tmdb_catalog_is_idempotent(db_session, monkeypatch):
    _patch_movie_fetch(monkeypatch)
    _run_sync(db_session)
    _run_sync(db_session)

    assert db_session.query(Film).filter(
        Film.tmdb_id.isnot(None), Film.content_type == "MOVIE"
    ).count() == 2


def test_movie_and_tv_ids_can_collide(db_session, monkeypatch):
    """TMDB movie ids and TV ids are separate id spaces — the same numeric id
    must be able to exist as both a MOVIE and a TV_SHOW row."""
    monkeypatch.setattr(tmdb_mod, "fetch_tmdb_movies", lambda key, pages: [
        {**MOVIE_SAMPLE[0], "id": 777, "title": "Dual Identity"},
    ])
    monkeypatch.setattr(tmdb_mod, "fetch_movie_director", lambda key, id: "Test Director")
    monkeypatch.setattr(tmdb_mod, "recompute_rankings", lambda db: datetime.now(timezone.utc))
    _run_sync(db_session)

    monkeypatch.setattr(tmdb_mod, "fetch_tmdb_tv", lambda key, pages: [
        {**TV_SAMPLE[0], "id": 777, "name": "Dual Identity: The Series"},
    ])
    monkeypatch.setattr(tmdb_mod, "fetch_tv_creator", lambda key, id: "Test Creator")
    _run_sync(db_session, content_type="TV_SHOW")

    rows = db_session.query(Film).filter(Film.tmdb_id == 777).all()
    assert len(rows) == 2
    assert {r.content_type for r in rows} == {"MOVIE", "TV_SHOW"}


def test_sync_tv_catalog_maps_tv_fields(db_session, monkeypatch):
    _patch_tv_fetch(monkeypatch)
    films = _run_sync(db_session, content_type="TV_SHOW")
    assert len(films) == 2

    db_session.expire_all()
    show = db_session.query(Film).filter_by(title="Starfall").first()
    assert show is not None
    assert show.content_type == "TV_SHOW"
    assert show.tmdb_id == 5001
    # TV dates land in first_air_date — never in release_date.
    assert show.first_air_date is not None
    assert show.first_air_date.year == 2025
    assert show.release_date is None
    assert show.year == 2025
    assert show.director == "Test Creator"  # creator, not a movie director
    # TV genre id space: 10765 → Sci-Fi (not the movie map's id 878).
    assert show.genre_tag == "Sci-Fi"


def test_sync_tv_catalog_is_idempotent(db_session, monkeypatch):
    _patch_tv_fetch(monkeypatch)
    _run_sync(db_session, content_type="TV_SHOW")
    _run_sync(db_session, content_type="TV_SHOW")

    assert db_session.query(Film).filter(
        Film.tmdb_id.isnot(None), Film.content_type == "TV_SHOW"
    ).count() == 2


def test_sync_requires_valid_content_type(db_session, monkeypatch):
    _patch_movie_fetch(monkeypatch)
    try:
        _run_sync(db_session, content_type="BOOK")
        assert False, "expected ValueError for unknown content type"
    except ValueError:
        pass


def test_sync_tmdb_catalog_backfills_legacy_row(db_session, monkeypatch):
    _patch_movie_fetch(monkeypatch)
    legacy = Film(slug="galactic", title="Galactic", director="Old Director", year=2024)
    db_session.add(legacy)
    db_session.commit()
    legacy_id = legacy.id

    _run_sync(db_session)

    db_session.expire_all()
    row = db_session.get(Film, legacy_id)
    assert row.tmdb_id == 1001
    assert row.content_type == "MOVIE"
    assert db_session.query(Film).filter_by(tmdb_id=1001).count() == 1
    assert db_session.query(Film).filter_by(tmdb_id=1002).count() == 1
