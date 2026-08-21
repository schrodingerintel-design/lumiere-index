"""Tests for the candidate discovery pipeline."""
from datetime import datetime, timezone

from app.config import settings
from app.ingest import discovery as disc
from app.ingest.discovery import (
    extract_candidates,
    _title_similarity,
    _find_year,
    _plausible,
)
from app.models import Film, Mention, PendingMention, Source

DUNE = {
    "id": 7001, "title": "Dune: Part Two", "original_title": "Dune: Part Two",
    "release_date": "2024-03-01", "popularity": 10.0, "vote_average": 8.0,
    "vote_count": 100, "poster_path": None, "backdrop_path": None,
    "origin_country": ["US"], "overview": "The desert epic returns.",
}


def _pending(db_session, text, external_id="p1"):
    src = Source(key="reddit", name="Reddit", weight=1.0)
    db_session.add(src)
    db_session.commit()
    db_session.refresh(src)
    p = PendingMention(
        source_id=src.id, external_id=external_id, text=text,
        engagement=10, created_at=datetime.now(timezone.utc),
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p, src


def _enable_key(monkeypatch):
    monkeypatch.setattr(settings, "tmdb_api_key", "test-key")


def _stub_search(monkeypatch):
    def fake_search(query, api_key):
        if "dune" in query.lower():
            return [DUNE]
        return []

    monkeypatch.setattr(disc, "search_tmdb", fake_search)


# --- unit tests -----------------------------------------------------------

def test_extract_candidates_quoted_title():
    out = extract_candidates('Just watched "Dune: Part Two" — incredible')
    assert "Dune: Part Two" in out


def test_extract_candidates_title_case_run():
    out = extract_candidates("The Batman was amazing last night")
    assert "The Batman" in out


def test_extract_candidates_filters_noise():
    out = extract_candidates("I watched the movie trailer today")
    assert out == []


def test_extract_candidates_dedupes():
    out = extract_candidates('"Mickey 17" and "mickey 17" are the same film')
    assert out.count("Mickey 17") + out.count("mickey 17") <= 1


def test_title_similarity():
    assert _title_similarity("Dune Part Two", "Dune: Part Two") == 1.0
    assert _title_similarity("Batman", "A Quiet Place") == 0.0


def test_find_year():
    assert _find_year("In 2025 it premiered everywhere") == 2025
    assert _find_year("No year here") is None


def test_plausible_year_handling():
    dune = {"title": "Dune: Part Two", "release_date": "2024-03-01"}
    assert _plausible("Dune: Part Two", dune, 2024)
    assert not _plausible("Dune: Part Two", dune, 1990)


# --- discovery pipeline ---------------------------------------------------

def test_discover_creates_film(db_session, monkeypatch):
    _enable_key(monkeypatch)
    _stub_search(monkeypatch)
    p, _ = _pending(db_session, 'Everyone is talking about "Dune: Part Two"')

    created = disc.discover_candidates(db_session)

    assert created == 1
    db_session.expire_all()
    film = db_session.query(Film).filter_by(tmdb_id=7001).first()
    assert film is not None
    assert film.title == "Dune: Part Two"

    db_session.refresh(p)
    assert p.status == "resolved"
    assert p.film_id == film.id
    assert db_session.query(Mention).filter_by(film_id=film.id).count() == 1


def test_discover_requires_api_key(db_session, monkeypatch):
    monkeypatch.setattr(settings, "tmdb_api_key", "")
    _stub_search(monkeypatch)
    p, _ = _pending(db_session, '"Dune: Part Two"')

    created = disc.discover_candidates(db_session)

    assert created == 0
    db_session.refresh(p)
    assert p.status == "pending"


def test_discover_dedupes_existing_tmdb_film(db_session, monkeypatch):
    _enable_key(monkeypatch)
    _stub_search(monkeypatch)
    existing = Film(
        slug="dune-part-two", title="Dune: Part Two", tmdb_id=7001, year=2024,
    )
    db_session.add(existing)
    db_session.commit()
    p, _ = _pending(db_session, '"Dune: Part Two"')

    created = disc.discover_candidates(db_session)

    assert created == 0
    assert db_session.query(Film).filter_by(tmdb_id=7001).count() == 1
    db_session.refresh(p)
    assert p.status == "resolved"


def test_discover_rejects_when_no_match(db_session, monkeypatch):
    _enable_key(monkeypatch)
    _stub_search(monkeypatch)
    p, _ = _pending(db_session, 'They loved "The Mystery of the Lost City"')

    created = disc.discover_candidates(db_session)

    assert created == 0
    db_session.refresh(p)
    assert p.status == "rejected"
