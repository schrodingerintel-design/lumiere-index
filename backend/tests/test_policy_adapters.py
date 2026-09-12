"""Unit tests for Stage 2, Stage 3, and Stage 4 adapters.

Covers:
  - TikTok: Policy-disabled stub, health status, and manual CSV import.
  - Instagram: Permanently disabled stub, health status, and manual CSV import.
  - X / Twitter: Permanently disabled stub, health status, and manual CSV import.
  - Reddit: Compliance-gated adapter (disabled by default), health status.
  - Letterboxd: Honest User-Agent, canonical slug resolution, and config gate.
  - Pipeline Ingestion: Safe db insertion of manual CSV mentions.
"""
from datetime import datetime, timezone
import pytest
from sqlalchemy.orm import Session

from app.config import settings
from app.core.source_policy import (
    STATUS_DISABLED_ACCESS_POLICY,
    STATUS_DISABLED_CONFIG,
    STATUS_OK,
)
from app.ingest.base import RawMention
from app.ingest.pipeline import ingest_batch
from app.ingest.tiktok import (
    TikTokAdapter,
    fetch_tiktok,
    ingest_from_csv as import_tiktok_csv,
)
from app.ingest.instagram import (
    InstagramAdapter,
    fetch_instagram,
    ingest_from_csv as import_instagram_csv,
)
from app.ingest.x import (
    XAdapter,
    fetch_x,
    ingest_from_csv as import_x_csv,
)
from app.ingest.reddit import (
    RedditAdapter,
    fetch_reddit,
)
from app.ingest.letterboxd import (
    LetterboxdAdapter,
    _canonical_slug,
    _USER_AGENT,
    fetch_letterboxd,
)
from app.models import Film, Mention


# ── TikTok Adapter Tests ──────────────────────────────────────────────────────

def test_tiktok_disabled_by_default():
    """TikTok adapter must not attempt network calls or RapidAPI scraping."""
    assert not settings.enable_tiktok_adapter
    mentions = fetch_tiktok([(1, "Mickey 17", 2025)])
    assert mentions == []

    adapter = TikTokAdapter()
    health = adapter.health()
    assert health.status == STATUS_DISABLED_ACCESS_POLICY
    assert "unapproved third-party scraper proxy" in health.last_error


def test_tiktok_manual_csv_import():
    """Manual CSV import allows lawfully collected TikTok analytics."""
    sample_csv = """date,video_views,likes,comments,shares
2026-09-01,100000,5000,300,150
2026-09-02,50000,2500,120,60
"""
    film_id = 99
    film_title = "Mickey 17"
    mentions = import_tiktok_csv(sample_csv, film_id, film_title)

    assert len(mentions) == 2
    m1 = mentions[0]
    assert m1.external_id == "tiktok_csv_99_2026-09-01"
    assert m1.observations == 100000
    assert m1.author == "tiktok_manual_export"
    assert "Mickey 17 TikTok analytics" in m1.text
    assert m1.engagement > 0
    assert m1.created_at.year == 2026
    assert m1.created_at.month == 9
    assert m1.created_at.day == 1


def test_tiktok_csv_import_handles_malformed_rows():
    """Corrupt or missing rows should be skipped gracefully."""
    sample_csv = """date,video_views,likes,comments,shares
invalid-date,100000,5000,300,150
2026-09-03,0,0,0,0
,50000,10,10,10
2026-09-04,20000,1000,50,20
"""
    mentions = import_tiktok_csv(sample_csv, 42, "Film 42")
    assert len(mentions) == 1
    assert mentions[0].external_id == "tiktok_csv_42_2026-09-04"


# ── Instagram Adapter Tests ───────────────────────────────────────────────────

def test_instagram_disabled_by_default():
    """Instagram adapter must return empty and report disabled access policy."""
    assert not settings.enable_instagram_adapter
    mentions = fetch_instagram([(1, "Mickey 17", 2025)])
    assert mentions == []

    adapter = InstagramAdapter()
    health = adapter.health()
    assert health.status == STATUS_DISABLED_ACCESS_POLICY
    assert "Meta Graph API requires" in health.last_error


def test_instagram_manual_csv_import():
    """Manual CSV import allows Meta Business Suite / Creator Studio exports."""
    sample_csv = """date,reach,impressions,likes,comments,saves
2026-09-05,25000,30000,1200,85,40
2026-09-06,18000,22000,900,45,20
"""
    mentions = import_instagram_csv(sample_csv, 10, "Dune: Part Two")
    assert len(mentions) == 2
    m1 = mentions[0]
    assert m1.external_id == "instagram_csv_10_2026-09-05"
    assert m1.observations == 30000
    assert m1.author == "instagram_manual_export"
    assert "Dune: Part Two Instagram analytics" in m1.text
    assert m1.engagement > 0


# ── X / Twitter Adapter Tests ─────────────────────────────────────────────────

def test_x_disabled_by_default():
    """X / Twitter adapter must return empty and report disabled access policy."""
    assert not settings.enable_x_adapter
    mentions = fetch_x([(1, "Mickey 17", 2025)])
    assert mentions == []

    adapter = XAdapter()
    health = adapter.health()
    assert health.status == STATUS_DISABLED_ACCESS_POLICY
    assert "X API v2 requires a paid developer plan" in health.last_error


def test_x_manual_csv_import():
    """Manual CSV import allows X Analytics exports."""
    sample_csv = """date,impressions,engagements,likes,replies,retweets
2026-09-07,80000,4500,2000,150,400
"""
    mentions = import_x_csv(sample_csv, 5, "Challengers")
    assert len(mentions) == 1
    m = mentions[0]
    assert m.external_id == "x_csv_5_2026-09-07"
    assert m.observations == 80000
    assert m.author == "x_manual_export"
    assert "Challengers X/Twitter analytics" in m.text
    assert m.engagement > 0


# ── Reddit Adapter Tests ──────────────────────────────────────────────────────

def test_reddit_compliance_gate():
    """Reddit adapter is disabled by default per 2023 policy."""
    assert not settings.enable_reddit_adapter
    mentions = fetch_reddit([(1, "Mickey 17", 2025, "MOVIE")])
    assert mentions == []

    adapter = RedditAdapter()
    health = adapter.health()
    assert health.status == STATUS_DISABLED_ACCESS_POLICY
    assert "ENABLE_REDDIT_ADAPTER=false" in health.last_error


# ── Letterboxd Adapter Tests ──────────────────────────────────────────────────

def test_letterboxd_honest_user_agent():
    """Letterboxd adapter must identify as Lumière, not spoof a browser."""
    assert "LumiereIndex" in _USER_AGENT
    assert "Mozilla" not in _USER_AGENT
    assert "contact@lumiere.film" in _USER_AGENT


def test_letterboxd_canonical_slug_variants():
    """Canonical slug generator should generate clean slugs with year fallback."""
    slugs = _canonical_slug("Mickey 17", 2025)
    assert slugs == ["mickey-17", "mickey-17-2025"]

    slugs_no_year = _canonical_slug("Dune", None)
    assert slugs_no_year == ["dune"]


# ── Database Ingestion of Manual CSV Mentions ──────────────────────────────────

def test_manual_csv_mentions_ingest_into_db(db_session: Session):
    """Verify that manual CSV mentions persist through standard ingest_batch."""
    film = Film(
        slug="test-csv-film",
        title="Test CSV Film",
        year=2026,
        director="Director B",
        content_type="MOVIE",
    )
    db_session.add(film)
    db_session.commit()

    sample_csv = """date,video_views,likes,comments,shares
2026-09-08,50000,2000,100,50
"""
    raw_mentions = import_tiktok_csv(sample_csv, film.id, film.title)
    assert len(raw_mentions) == 1

    # Ingest through standard pipeline
    inserted = ingest_batch(db_session, "tiktok", raw_mentions)
    assert inserted == 1

    mention = db_session.query(Mention).filter(Mention.external_id.like("tiktok_csv_%_2026-09-08")).first()
    assert mention is not None
    assert mention.film_id == film.id
    assert mention.observations == 50000
    assert mention.sentiment_score is not None  # Sentiment analyzer runs on text
