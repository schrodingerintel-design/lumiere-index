"""Catalog metadata-integrity — identity guarantees (the Titans incident).

Production incident, 2026-09-22: Titans (2026, unreleased) displayed
Wrath of the Titans (2012)'s $150M budget, $302M box office, 99-minute
runtime and studios because the film page enriched itself by TITLE search
and took the first result. These tests lock the pipeline-level response:

  1. Year is mandatory in any title-based identity resolution — a result
     from a different year is a different film and must be discarded.
  2. "No confident match" resolves to None, never to a wrong-film match.
  3. Legacy catalog links require title + year; title alone never links
     (otherwise generic titles like Home/Heat/Crash/Us collide forever).
  4. The API serializes tmdb_id + is_upcoming so film pages can enrich by
     stored ID and label unreleased titles UPCOMING.
"""
from datetime import date, timedelta

import pytest

from app.ingest.tmdb import _upsert_content
from app.models import Film, Ranking
from app.services import correction


# ── Identity resolution: year is mandatory ──────────────────────────────────

def _result(rid, title, release, popularity=10.0):
    return {"id": rid, "title": title, "release_date": release, "popularity": popularity}


class TestBestMatchByTitleYear:
    def test_matches_only_same_year(self):
        results = [
            _result(101, "Titans", "2012-03-30", popularity=90.0),
            _result(202, "Titans", "2026-10-01", popularity=5.0),
        ]
        match = correction.best_match_by_title_year(results, 2026, "Titans")
        assert match is not None and match["id"] == 202

    def test_no_same_year_returns_none_not_the_popular_wrong_film(self):
        results = [_result(101, "Titans", "2012-03-30", popularity=90.0)]
        assert correction.best_match_by_title_year(results, 2026, "Titans") is None

    def test_unknown_year_is_never_resolved(self):
        results = [_result(101, "Home", "2015-03-06")]
        assert correction.best_match_by_title_year(results, None, "Home") is None

    def test_exact_title_preferred_over_same_year_partial(self):
        results = [
            _result(1, "The Early Spring", "2026-03-01", popularity=50.0),
            _result(2, "Early Spring", "2026-03-01", popularity=10.0),
        ]
        match = correction.best_match_by_title_year(results, 2026, "Early Spring")
        assert match is not None and match["id"] == 2

    def test_popularity_breaks_ties_within_the_year(self):
        results = [
            _result(1, "Titans", "2026-10-01", popularity=3.0),
            _result(2, "Titans!", "2026-10-01", popularity=30.0),
        ]
        match = correction.best_match_by_title_year(results, 2026, "Nobody Knows This Title")
        assert match is not None and match["id"] == 2


# ── Legacy catalog linking: title alone never links ─────────────────────────

def _tmdb_item(tmdb_id, title, release, popularity=10.0):
    return {
        "id": tmdb_id, "title": title, "original_title": title,
        "release_date": release, "poster_path": None, "backdrop_path": None,
        "overview": "overview", "genre_ids": [18], "popularity": popularity,
    }


@pytest.fixture
def no_network_director(monkeypatch):
    """Keep _upsert_content offline: no TMDB key in tests, and director
    fetches must never leave the process."""
    import app.ingest.tmdb as tmdb_mod
    monkeypatch.setattr(tmdb_mod, "fetch_movie_director", lambda api_key, tmdb_id: "Test Director")


class TestLegacyLinking:
    def test_links_legacy_row_on_title_and_year(self, db_session, no_network_director):
        legacy = Film(slug="titans-2012", title="Titans", year=2012, content_type="MOVIE")
        db_session.add(legacy)
        db_session.commit()

        film, created = _upsert_content(db_session, _tmdb_item(99, "Titans", "2012-03-30"), "MOVIE")
        assert not created
        assert film.id == legacy.id
        assert film.tmdb_id == 99

    def test_title_alone_never_links_across_years(self, db_session, no_network_director):
        """The exact Titans failure mode: 2026 row must NOT adopt the 2012
        film's TMDB identity. A new row is created instead."""
        modern = Film(slug="titans", title="Titans", year=2026, content_type="MOVIE",
                      release_date=date(2026, 10, 1))
        db_session.add(modern)
        db_session.commit()

        film, created = _upsert_content(db_session, _tmdb_item(99, "Titans", "2012-03-30"), "MOVIE")
        assert created, "a different-year title must never link to the existing row"
        assert film.id != modern.id
        assert modern.tmdb_id is None, "the 2026 row's identity is untouched"


# ── Repair + audit ───────────────────────────────────────────────────────────

class TestRepairAndAudit:
    def test_repair_links_by_title_and_year(self, db_session, monkeypatch):
        film = Film(slug="titans", title="Titans", year=2026, content_type="MOVIE",
                    release_date=date(2026, 10, 1))
        db_session.add(film)
        db_session.commit()
        monkeypatch.setattr(
            correction, "_tmdb_search",
            lambda endpoint, title, year: [
                _result(101, "Titans", "2012-03-30", popularity=90.0),
                _result(202, "Titans", "2026-10-01", popularity=5.0),
            ],
        )
        report = correction.repair_film_identity(db_session, film)
        assert report["action"] == "linked"
        assert film.tmdb_id == 202, "the 2012 blockbuster must never be chosen"

    def test_repair_refuses_low_confidence(self, db_session, monkeypatch):
        film = Film(slug="obscure-title", title="Obscure Title", year=2031, content_type="MOVIE")
        db_session.add(film)
        db_session.commit()
        monkeypatch.setattr(correction, "_tmdb_search", lambda endpoint, title, year: [])
        report = correction.repair_film_identity(db_session, film)
        assert report["action"] == "no_confident_match"
        assert film.tmdb_id is None, "no match beats a wrong match"

    def test_repair_is_idempotent(self, db_session):
        film = Film(slug="already-linked", title="Already Linked", year=2024,
                    content_type="MOVIE", tmdb_id=555)
        db_session.add(film)
        db_session.commit()
        report = correction.repair_film_identity(db_session, film)
        assert report["action"] == "already_linked"
        assert film.tmdb_id == 555

    def test_known_incident_repair_targets_titans(self, db_session, monkeypatch):
        film = Film(slug="titans", title="Titans", year=2026, content_type="MOVIE",
                    release_date=date(2026, 10, 1))
        db_session.add(film)
        db_session.commit()
        calls = []

        def fake_search(endpoint, title, year):
            calls.append((endpoint, title, year))
            return [_result(202, "Titans", "2026-10-01")]

        monkeypatch.setattr(correction, "_tmdb_search", fake_search)
        reports = correction.repair_known_incidents(db_session)
        assert any(r["film"] == "titans" and r["action"] == "linked" for r in reports)
        assert calls and calls[0][2] == 2026, "the year filter must be part of the search"

    def test_audit_flags_missing_ids_and_upcoming(self, db_session):
        today = date.today()
        linked = Film(slug="linked", title="Linked", year=2024, content_type="MOVIE", tmdb_id=1)
        unlinked = Film(slug="unlinked", title="Unlinked", year=2024, content_type="MOVIE")
        future = Film(slug="future-title", title="Future Title", year=2027, content_type="MOVIE",
                      release_date=today + timedelta(days=30))
        db_session.add_all([linked, unlinked, future])
        db_session.commit()
        # The fixture also seeds Mickey 17 / Superman, so assert on this
        # test's rows (audit probes fail closed with no TMDB key).
        report = correction.audit_catalog_integrity(db_session, max_probe=1)
        assert report["checked"] >= 3
        assert "unlinked" in report["tmdb_missing_slugs"]
        assert "future-title" in report["upcoming_slugs"]
        assert report["upcoming_count"] >= 1
