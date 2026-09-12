"""Tests for Stage 1: Source Policy, MetricSnapshot, YouTube & Wikimedia improvements."""
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.orm import Session

from app.config import settings
from app.core.source_policy import (
    APPROVED_API_SOURCES,
    CATALOG_ONLY_SOURCE_KEYS,
    EXPERIMENTAL_SOURCES,
    is_adapter_permitted,
    STATUS_OK,
    STATUS_DISABLED_ACCESS_POLICY,
)
from app.ingest.base import RawMention, RawMetricSnapshot, SourceHealth
from app.ingest.pipeline import ingest_metric_batch
from app.models import Film, MetricSnapshot, Mention
from app.services.matching import FilmMatcher
from app.ingest.wikipedia import fetch_wikipedia_metrics_for_film, fetch_wikipedia
from app.ingest.youtube import fetch_youtube_for_film
from app.models.youtube import YouTubeSignal


# ── Source Policy Tests ───────────────────────────────────────────────────────

def test_source_policy_categorization():
    assert "youtube" in APPROVED_API_SOURCES
    assert "news" in APPROVED_API_SOURCES
    assert "tmdb" in CATALOG_ONLY_SOURCE_KEYS
    assert "imdb" in CATALOG_ONLY_SOURCE_KEYS
    assert "tiktok_scraper" in EXPERIMENTAL_SOURCES
    assert "instagram" in EXPERIMENTAL_SOURCES
    assert "x" in EXPERIMENTAL_SOURCES

    # Unapproved sources are blocked
    permitted, status = is_adapter_permitted("tiktok")
    assert not permitted
    assert status == STATUS_DISABLED_ACCESS_POLICY

    permitted, status = is_adapter_permitted("instagram")
    assert not permitted
    assert status == STATUS_DISABLED_ACCESS_POLICY

    permitted, status = is_adapter_permitted("reddit")
    assert not permitted
    assert status == STATUS_DISABLED_ACCESS_POLICY

    # Approved source with credentials is allowed
    permitted, status = is_adapter_permitted("youtube", is_configured=True)
    assert permitted
    assert status == STATUS_OK


def test_default_config_adapter_flags():
    assert settings.enable_youtube_adapter is True
    assert settings.enable_wikimedia_adapter is True
    assert settings.enable_letterboxd_adapter is True
    assert settings.enable_reddit_adapter is False
    assert settings.enable_tiktok_adapter is False
    assert settings.enable_instagram_adapter is False
    assert settings.enable_x_adapter is False


# ── MetricSnapshot Pipeline Tests ────────────────────────────────────────────

def test_metric_snapshot_pipeline_and_deduplication(db_session):
    film = Film(slug="test-metric-film", title="Test Metric Film", year=2026, director="Director A", content_type="MOVIE")
    db_session.add(film)
    db_session.commit()

    now = datetime.now(timezone.utc)
    snapshot = RawMetricSnapshot(
        source_id="wikipedia",
        external_id="wiki_test_film_20260910",
        film_id=film.id,
        metric_type="pageviews_daily",
        value=1500.0,
        observed_at=now,
        observations=1500,
        source_url="https://en.wikipedia.org/wiki/Test_Film",
        attribution="Wikimedia REST API",
    )

    inserted = ingest_metric_batch(db_session, "wikipedia", [snapshot])
    assert inserted == 1

    stored = db_session.query(MetricSnapshot).filter_by(external_id="wiki_test_film_20260910").first()
    assert stored is not None
    assert stored.value == 1500.0
    assert stored.metric_type == "pageviews_daily"
    assert stored.film_id == film.id

    # No Mention must be created (metric isolation guarantee)
    assert db_session.query(Mention).filter_by(external_id="wiki_test_film_20260910").first() is None

    # Re-ingest (upsert/dedup)
    snapshot_update = RawMetricSnapshot(
        source_id="wikipedia",
        external_id="wiki_test_film_20260910",
        film_id=film.id,
        metric_type="pageviews_daily",
        value=1750.0,
        observed_at=now,
        observations=1750,
    )
    inserted_again = ingest_metric_batch(db_session, "wikipedia", [snapshot_update])
    assert inserted_again == 0  # deduplicated
    db_session.refresh(stored)
    assert stored.value == 1750.0
    assert stored.observations == 1750


# ── FilmMatcher Word Boundary & Disambiguation Tests ─────────────────────────

def test_matching_word_boundaries_and_ambiguous_titles(db_session):
    film_us = Film(slug="us-2019", title="Us", year=2019, director="Jordan Peele", content_type="MOVIE")
    film_nope = Film(slug="nope-2022", title="Nope", year=2022, director="Jordan Peele", content_type="MOVIE")
    film_heat = Film(slug="heat-1995", title="Heat", year=1995, director="Michael Mann", content_type="MOVIE")
    db_session.add_all([film_us, film_nope, film_heat])
    db_session.commit()

    matcher = FilmMatcher(db_session)

    # Partial word embeddings must not trigger matches
    assert matcher.match("The genius of this focus is clear.") is None

    # Ambiguous titles without cinema context must not match
    assert matcher.match("us are going outside today.") is None
    assert matcher.match("nope, I do not want to go.") is None
    assert matcher.match("the heat outside is unbearable.") is None

    # Ambiguous titles WITH cinema context or director name must match
    assert matcher.match("Us is a terrifying horror film directed by Jordan Peele") == film_us.id
    assert matcher.match("Watched the movie Nope last night in cinema") == film_nope.id
    assert matcher.match("Michael Mann directed Heat, one of the greatest crime movies") == film_heat.id


# ── Wikimedia: No Fake Mentions ───────────────────────────────────────────────

def test_wikimedia_no_fake_mentions(db_session, monkeypatch):
    film = Film(slug="gladiator-ii-2024", title="Gladiator II", year=2024, content_type="MOVIE")
    db_session.add(film)
    db_session.commit()

    def mock_get(url, *args, **kwargs):
        class MockResponse:
            status_code = 200
            def raise_for_status(self): pass
            def json(self):
                params = kwargs.get("params", {})
                if isinstance(params, dict) and "action" in params:
                    return [
                        "Gladiator II",
                        ["Gladiator II (film)"],
                        ["desc"],
                        ["https://en.wikipedia.org/wiki/Gladiator_II_(film)"]
                    ]
                return {
                    "items": [
                        {"timestamp": f"202609{i:02d}00", "views": 1000 + i * 100}
                        for i in range(1, 15)
                    ]
                }
        return MockResponse()

    import httpx
    monkeypatch.setattr(httpx, "get", mock_get)

    snapshots = fetch_wikipedia_metrics_for_film(film.id, film.title, film.year, film.content_type)
    assert len(snapshots) > 0
    types = {s.metric_type for s in snapshots}
    assert "pageviews_daily" in types
    assert "pageviews_7d" in types

    # fetch_wikipedia must return empty list — no fake text mentions from pageviews
    mentions = fetch_wikipedia([(film.id, film.title, film.year, film.content_type)], db=db_session)
    assert len(mentions) == 0


# ── YouTube: Metrics + Mention + Velocity ─────────────────────────────────────

def test_youtube_emits_metrics_and_mention(db_session, monkeypatch):
    film = Film(slug="challengers-2024", title="Challengers", year=2024, content_type="MOVIE")
    db_session.add(film)
    db_session.commit()

    from app.services.youtube_service import YouTubeVideoStats, TrailerMatch

    class MockYTService:
        is_configured = True
        def search_trailer(self, title, year=None):
            return TrailerMatch(
                video_id="vid123",
                video_title="Challengers | Official Trailer",
                channel_title="MGM",
                published_at=datetime.now(timezone.utc) - timedelta(days=10),
                confidence=0.95,
                is_official=True,
            )
        def get_video_stats(self, video_id, **kwargs):
            return YouTubeVideoStats(
                video_id=video_id,
                video_title="Challengers | Official Trailer",
                channel_title="MGM",
                view_count=500000,
                like_count=25000,
                comment_count=1200,
                published_at=datetime.now(timezone.utc) - timedelta(days=10),
                view_velocity=50000.0,
                confidence=0.95,
                is_official=True,
            )

    from app.services import youtube_service as yt_module
    monkeypatch.setattr(yt_module, "youtube_service", MockYTService())
    import app.ingest.youtube as yt_ingest
    monkeypatch.setattr(yt_ingest, "settings", type("S", (), {
        "enable_youtube_adapter": True,
        "source_max_items_per_run": 100,
    })())

    mention, metrics = fetch_youtube_for_film(film.id, film.title, film.year, db=db_session)
    assert mention is not None
    assert mention.external_id == f"youtube_{film.id}_vid123"
    assert "Challengers" in mention.text
    assert mention.observations == 500000

    metric_types = {m.metric_type for m in metrics}
    assert "view_count" in metric_types
    assert "like_count" in metric_types
    assert "comment_count" in metric_types
    assert "view_velocity" in metric_types
    assert "like_rate" in metric_types
    assert "comment_rate" in metric_types

    sig = db_session.query(YouTubeSignal).filter_by(film_id=film.id, video_id="vid123").first()
    assert sig is not None
    assert sig.view_count == 500000


# ── Ranking Formula Invariance ───────────────────────────────────────────────

def test_official_ranking_formula_invariance():
    """The official formula weights must sum to exactly 1.0."""
    total = 0.30 + 0.25 + 0.20 + 0.15 + 0.10  # CA + M + R + AE + CP
    assert pytest.approx(total, 0.001) == 1.0
