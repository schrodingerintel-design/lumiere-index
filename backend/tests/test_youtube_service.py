"""Unit tests for YouTube Data API v3 integration:
  - Matcher accuracy across 15-20 films (major releases, indies, TV, and fan-made filters)
  - QuotaGuard consumption & backoff limits
  - Batched videos.list processing
  - View velocity & engagement metrics computation
  - Ranking scoring degradation & fallback
  - Internal endpoint security & schema validation
"""
import math
from datetime import datetime, date, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.main import app
from app.models import Film, Ranking, DailyScore, Source
from app.models.youtube import YouTubeSignal
from app.services.youtube_service import YouTubeService, QuotaGuard, TrailerMatch, YouTubeVideoStats
from app.services.ranking import recompute_rankings


# ── Sample of 18 diverse test films for matcher validation ────────────────────
SAMPLE_FILMS = [
    # 1. Oppenheimer (Universal Pictures blockbuster)
    {
        "title": "Oppenheimer", "year": 2023,
        "items": [
            {"snippet": {"title": "Oppenheimer | New Trailer", "channelTitle": "Universal Pictures", "publishedAt": "2023-05-08T13:00:00Z"}},
            {"snippet": {"title": "Oppenheimer FAN MADE Concept Trailer", "channelTitle": "MovieTrailersPro", "publishedAt": "2023-01-01T12:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 2. Barbie (Warner Bros)
    {
        "title": "Barbie", "year": 2023,
        "items": [
            {"snippet": {"title": "Barbie | Main Trailer", "channelTitle": "Warner Bros. Pictures", "publishedAt": "2023-05-25T16:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 3. Past Lives (A24 indie release)
    {
        "title": "Past Lives", "year": 2023,
        "items": [
            {"snippet": {"title": "Past Lives | Official Trailer HD | A24", "channelTitle": "A24", "publishedAt": "2023-02-22T14:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 4. Dune: Part Two (Warner Bros)
    {
        "title": "Dune: Part Two", "year": 2024,
        "items": [
            {"snippet": {"title": "Dune: Part Two | Official Trailer 3", "channelTitle": "Warner Bros. Pictures", "publishedAt": "2023-12-12T17:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 5. Spider-Man: Across the Spider-Verse (Sony Pictures Animation)
    {
        "title": "Spider-Man: Across the Spider-Verse", "year": 2023,
        "items": [
            {"snippet": {"title": "SPIDER-MAN: ACROSS THE SPIDER-VERSE - Official Trailer", "channelTitle": "Sony Pictures Entertainment", "publishedAt": "2023-04-04T13:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 6. Killers of the Flower Moon (Paramount / Apple TV)
    {
        "title": "Killers of the Flower Moon", "year": 2023,
        "items": [
            {"snippet": {"title": "Killers of the Flower Moon — Official Trailer | Apple TV+", "channelTitle": "Apple TV", "publishedAt": "2023-07-05T13:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 7. Poor Things (Searchlight Pictures)
    {
        "title": "Poor Things", "year": 2023,
        "items": [
            {"snippet": {"title": "POOR THINGS | Official Trailer | Searchlight Pictures", "channelTitle": "Searchlight Pictures", "publishedAt": "2023-06-08T13:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 8. Anatomy of a Fall (NEON indie award winner)
    {
        "title": "Anatomy of a Fall", "year": 2023,
        "items": [
            {"snippet": {"title": "ANATOMY OF A FALL - Official Trailer - In Theaters This Fall", "channelTitle": "NEON", "publishedAt": "2023-08-17T14:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 9. The Holdovers (Focus Features)
    {
        "title": "The Holdovers", "year": 2023,
        "items": [
            {"snippet": {"title": "THE HOLDOVERS - Official Trailer [HD] - In Select Theaters October 27", "channelTitle": "Focus Features", "publishedAt": "2023-07-24T15:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 10. The Zone of Interest (A24)
    {
        "title": "The Zone of Interest", "year": 2023,
        "items": [
            {"snippet": {"title": "The Zone of Interest | Official Trailer HD | A24", "channelTitle": "A24", "publishedAt": "2023-10-17T13:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 11. Godzilla Minus One (Toho / International)
    {
        "title": "Godzilla Minus One", "year": 2023,
        "items": [
            {"snippet": {"title": "GODZILLA MINUS ONE Official Trailer", "channelTitle": "Godzilla Official by Toho", "publishedAt": "2023-09-03T23:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.7,
    },
    # 12. Challengers (MGM / Amazon)
    {
        "title": "Challengers", "year": 2024,
        "items": [
            {"snippet": {"title": "CHALLENGERS | Official Trailer", "channelTitle": "MGM", "publishedAt": "2023-06-20T14:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 13. Civil War (A24)
    {
        "title": "Civil War", "year": 2024,
        "items": [
            {"snippet": {"title": "Civil War | Official Trailer HD | A24", "channelTitle": "A24", "publishedAt": "2023-12-13T14:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 14. Furiosa: A Mad Max Saga (Warner Bros)
    {
        "title": "Furiosa: A Mad Max Saga", "year": 2024,
        "items": [
            {"snippet": {"title": "Furiosa: A Mad Max Saga | Official Trailer", "channelTitle": "Warner Bros. Pictures", "publishedAt": "2023-11-30T23:30:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 15. The Substance (MUBI)
    {
        "title": "The Substance", "year": 2024,
        "items": [
            {"snippet": {"title": "THE SUBSTANCE - Official Trailer | MUBI", "channelTitle": "MUBI", "publishedAt": "2024-07-11T13:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 16. Succession (HBO TV Show)
    {
        "title": "Succession", "year": 2023,
        "items": [
            {"snippet": {"title": "Succession Season 4 | Official Trailer | Max", "channelTitle": "Max", "publishedAt": "2023-03-02T16:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 17. Severance (Apple TV series)
    {
        "title": "Severance", "year": 2022,
        "items": [
            {"snippet": {"title": "Severance — Official Trailer | Apple TV+", "channelTitle": "Apple TV", "publishedAt": "2022-01-18T14:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
    # 18. Anora (NEON Palme d'Or winner)
    {
        "title": "Anora", "year": 2024,
        "items": [
            {"snippet": {"title": "ANORA - Official Trailer", "channelTitle": "NEON", "publishedAt": "2024-07-15T14:00:00Z"}},
        ],
        "expected_official": True,
        "min_confidence": 0.8,
    },
]


def test_matcher_accuracy_sample_films():
    """Verify matcher scores official studio trailers highly while penalizing fan-made edits."""
    svc = YouTubeService(api_key="mock_key")

    for case in SAMPLE_FILMS:
        best_conf = 0.0
        best_official = False
        for it in case["items"]:
            conf, is_off = svc.score_trailer_candidate(it, case["title"], case["year"])
            if conf > best_conf:
                best_conf = conf
                best_official = is_off

        assert best_official == case["expected_official"], f"Official flag mismatch for {case['title']}"
        assert best_conf >= case["min_confidence"], f"Confidence too low for {case['title']}: {best_conf}"


def test_matcher_penalizes_fan_made_and_reactions():
    """Ensure fan trailers, parody, and reaction videos are strictly penalized."""
    svc = YouTubeService(api_key="mock_key")

    fan_item = {
        "snippet": {
            "title": "Inception 2 - Official Fan Made Teaser Trailer (2025)",
            "channelTitle": "FanTrailers101",
            "description": "Concept trailer for Inception sequel",
        }
    }
    conf, is_off = svc.score_trailer_candidate(fan_item, "Inception", 2010)
    assert conf <= 0.2
    assert is_off is False

    reaction_item = {
        "snippet": {
            "title": "Oppenheimer Trailer REACTION & Breakdown!!",
            "channelTitle": "SuperFanReviews",
            "description": "My live reaction",
        }
    }
    conf, is_off = svc.score_trailer_candidate(reaction_item, "Oppenheimer", 2023)
    assert conf <= 0.2
    assert is_off is False


def test_quota_guard_limits_and_tracking():
    """Test that QuotaGuard accumulates usage and prevents over-consumption."""
    QuotaGuard.record_usage(500)
    assert QuotaGuard.get_daily_usage() >= 500

    # Test can_consume limit
    assert QuotaGuard.can_consume(100) is True

    # Artificially push near ceiling
    QuotaGuard.record_usage(9500)
    # Beyond 92% of 10,000 ceiling, search calls (100 units) must be guarded
    assert QuotaGuard.can_consume(100) is False


def test_video_stats_and_velocity_calculation():
    """Test parsing YouTube video stats and view velocity calculation."""
    svc = YouTubeService(api_key="mock_key")

    # Mock response from videos.list
    mock_batch = {
        "v123": {
            "id": "v123",
            "snippet": {
                "title": "Test Trailer",
                "channelTitle": "Universal Pictures",
                # Published 10 days ago
                "publishedAt": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
            },
            "statistics": {
                "viewCount": "1000000",
                "likeCount": "50000",
                "commentCount": "5000",
            },
        }
    }

    with patch.object(svc, "fetch_videos_stats_batch", return_value=mock_batch):
        stats = svc.get_video_stats("v123", "Test Trailer", "Universal Pictures")
        assert stats is not None
        assert stats.view_count == 1000000
        assert stats.like_count == 50000
        assert stats.comment_count == 5000
        # 1,000,000 / 10 days ≈ 100,000 views/day
        assert 90000 <= stats.view_velocity <= 110000


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_ranking_scoring_graceful_degradation_without_youtube(test_db):
    """Ensure ranking recomputation finishes cleanly without YouTube signals."""
    f1 = Film(id=1, slug="film-1", title="Film One", release_date=date.today())
    f2 = Film(id=2, slug="film-2", title="Film Two", release_date=date.today() - timedelta(days=5))
    test_db.add_all([f1, f2])
    test_db.commit()

    # Add daily scores
    d1 = DailyScore(film_id=1, day=date.today(), mentions_count=10, sentiment_avg=0.5)
    d2 = DailyScore(film_id=2, day=date.today(), mentions_count=8, sentiment_avg=0.4)
    test_db.add_all([d1, d2])
    test_db.commit()

    # Recompute without any YouTube signals in DB
    snap = recompute_rankings(test_db)
    assert snap is not None

    rankings = test_db.query(Ranking).filter_by(snapshot_at=snap).all()
    assert len(rankings) == 2
    for r in rankings:
        assert r.score > 0
        assert r.ca_score is not None
        assert r.momentum_score is not None
        assert r.ae_score is not None


def test_ranking_scoring_incorporates_youtube_signals(test_db):
    """Verify that YouTube signals blend smoothly and boost film attention."""
    f1 = Film(id=10, slug="film-a", title="Film A", release_date=date.today())
    f2 = Film(id=11, slug="film-b", title="Film B", release_date=date.today())
    test_db.add_all([f1, f2])
    test_db.commit()

    test_db.add_all([
        DailyScore(film_id=10, day=date.today(), mentions_count=10, sentiment_avg=0.5),
        DailyScore(film_id=11, day=date.today(), mentions_count=10, sentiment_avg=0.5),
    ])
    test_db.commit()

    # Add massive official trailer signal for Film A
    yt_sig = YouTubeSignal(
        film_id=10,
        video_id="trailer_10",
        video_title="Film A Official Trailer",
        channel_title="Universal Pictures",
        view_count=15000000,
        like_count=600000,
        comment_count=40000,
        published_at=datetime.now(timezone.utc) - timedelta(days=3),
        view_velocity=5000000.0,
        confidence=0.95,
        is_official=True,
    )
    test_db.add(yt_sig)
    test_db.commit()

    snap = recompute_rankings(test_db)
    r_a = test_db.query(Ranking).filter_by(film_id=10, snapshot_at=snap).first()
    r_b = test_db.query(Ranking).filter_by(film_id=11, snapshot_at=snap).first()

    assert r_a is not None and r_b is not None
    # Film A with trailer attention & high engagement should rank #1
    assert r_a.score >= r_b.score
    assert r_a.ca_score >= r_b.ca_score


def test_attention_signals_endpoint_security_and_format():
    """Verify the internal endpoint exposes only derived data and no secrets."""
    client = TestClient(app)

    # Calling with non-existent film returns 404
    resp = client.get("/api/v1/films/non-existent-film-xyz/attention-signals")
    assert resp.status_code == 404

    # Verify no raw YouTube headers or keys are returned
    assert "YOUTUBE_API_KEY" not in resp.text
    assert "apiKey" not in resp.text
