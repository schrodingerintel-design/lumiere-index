"""Tests for trending endpoint + evidence-gated editorial briefs."""
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Film, Ranking, Mention, Source


def _setup_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()

    f1 = Film(slug="film-a", title="Film A", director="Director A", year=2025,
              release_date=datetime.now(timezone.utc).date() - timedelta(days=10))
    f2 = Film(slug="film-b", title="Film B", director="Director B", year=2025,
              release_date=datetime.now(timezone.utc).date() - timedelta(days=20))
    session.add_all([f1, f2])
    session.commit()

    snap = datetime.now(timezone.utc)
    r1 = Ranking(film_id=f1.id, snapshot_at=snap, rank=1, score=98.0, movement=12,
                 ca_score=0.4, momentum_score=0.7, recency_score=0.3,
                 ae_score=0.5, cp_score=0.4)
    r2 = Ranking(film_id=f2.id, snapshot_at=snap, rank=2, score=85.0, movement=1,
                 ca_score=0.0, momentum_score=0.0, recency_score=0.0,
                 ae_score=0.0, cp_score=0.0)
    session.add_all([r1, r2])
    session.commit()

    src = Source(key="reddit", name="Reddit", weight=1.0)
    session.add(src)
    session.commit()

    # Add mentions for film A (high engagement, all within the last 24h)
    for i in range(5):
        m = Mention(
            film_id=f1.id, source_id=src.id, external_id=f"ext_{i}",
            text="Great film!", sentiment_score=0.8, sentiment_label="positive",
            engagement=10, created_at=snap,
        )
        session.add(m)
    session.commit()

    return engine, session_factory, session


def _client_with(session):
    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_trending_films_returns_data():
    engine, session_factory, session = _setup_db()
    try:
        with _client_with(session) as client:
            response = client.get("/api/v1/trending/films?limit=10")
            assert response.status_code == 200
            data = response.json()
            # Film A (5 mentions → low) is shown; Film B (0 mentions →
            # insufficient) is omitted from the trending surface entirely.
            assert len(data) == 1
            assert data[0]["film_slug"] == "film-a"
            assert data[0]["mentions_24h"] == 5
            assert all(f["film_slug"] != "film-b" for f in data)
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_confidence_tier_reflects_sample_size():
    engine, session_factory, session = _setup_db()
    try:
        with _client_with(session) as client:
            data = client.get("/api/v1/trending/films?limit=10").json()
            film_a = next(f for f in data if f["film_slug"] == "film-a")
            # Film A has 5 mentions → low (hedged tier, still shown)
            assert film_a["sample_size"] == 5
            assert film_a["confidence"] == "low"
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_low_tier_copy_is_hedged_not_superlative():
    engine, session_factory, session = _setup_db()
    try:
        with _client_with(session) as client:
            data = client.get("/api/v1/trending/films?limit=10").json()
            film_a = next(f for f in data if f["film_slug"] == "film-a")
            reason = film_a["trend_reason"].lower()
            # Hedged, specific, no superlatives even though movement=12
            assert "limited early signal" in reason
            assert "surg" not in reason
            assert "dominant" not in reason
            assert "sustained" not in reason
            assert "5 mentions" in reason
            # Driver label names an actual component (momentum)
            assert film_a["driver_label"] == "Momentum Surge"
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_insufficient_tier_copy_is_neutral():
    """The neutral, claim-free state comes from _build_brief directly —
    insufficient titles never reach the trending surface at all, but if one
    did render (e.g. a per-title editorial panel), it must say nothing
    claim-bearing."""
    from app.api.v1.trending import _build_brief

    reason = _build_brief(
        title="Film B", driver=None, confidence="insufficient", sample_size=1,
        attention_delta_pct=None, top_platform=None, mentions_24h=1,
        weeks_on_chart=1, score=85.0, days_since_release=None,
    )
    lowered = reason.lower()
    assert "just entered tracking" in lowered
    assert "not enough signal" in lowered
    # No claim-bearing numbers / superlatives
    assert "dominant" not in lowered
    assert "sustained" not in lowered
    assert not any(ch.isdigit() for ch in reason)

    # A film with the same one-mention profile is omitted from the feed.
    engine, session_factory, session = _setup_db()
    try:
        with _client_with(session) as client:
            data = client.get("/api/v1/trending/films?limit=10").json()
            assert all(f["film_slug"] != "film-b" for f in data)
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_delta_is_none_without_prior_baseline():
    """All 5 mentions are < 3 days old and there is no prior 3-day baseline.

    Claiming "+100%" or "+0%" against nothing is fabrication — the delta must
    be null and the copy must not contain a percentage.
    """
    engine, session_factory, session = _setup_db()
    try:
        with _client_with(session) as client:
            data = client.get("/api/v1/trending/films?limit=10").json()
            film_a = next(f for f in data if f["film_slug"] == "film-a")
            assert film_a["attention_delta_pct"] is None
            assert "%" not in film_a["trend_reason"]
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_moderate_and_high_tiers_allow_confident_copy():
    """Films with 25+ / 100+ raw mentions get confident, specific copy."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()

    today = datetime.now(timezone.utc).date()
    f_mod = Film(slug="film-mod", title="Film Moderate", year=2025, release_date=today - timedelta(days=5))
    f_high = Film(slug="film-high", title="Film High", year=2025, release_date=today - timedelta(days=5))
    session.add_all([f_mod, f_high])
    session.commit()
    snap = datetime.now(timezone.utc)
    session.add_all([
        Ranking(film_id=f_mod.id, snapshot_at=snap, rank=1, score=97.0, movement=12,
                ca_score=0.3, momentum_score=0.7, recency_score=0.4, ae_score=0.5, cp_score=0.4),
        Ranking(film_id=f_high.id, snapshot_at=snap, rank=2, score=95.0, movement=12,
                ca_score=0.3, momentum_score=0.7, recency_score=0.4, ae_score=0.5, cp_score=0.4),
    ])
    src = Source(key="reddit", name="Reddit", weight=1.0)
    session.add(src)
    session.commit()
    now = datetime.now(timezone.utc)
    # Recent-window mentions (drives the delta)
    for i in range(30):
        session.add(Mention(film_id=f_mod.id, source_id=src.id, external_id=f"m-{i}",
                            text="Great movie!", created_at=now))
    for i in range(120):
        session.add(Mention(film_id=f_high.id, source_id=src.id, external_id=f"h-{i}",
                            text="Amazing film!", created_at=now))
    # Prior-window mentions (provides the 3-day baseline so a real delta exists)
    prior = now - timedelta(days=4)
    for i in range(10):
        session.add(Mention(film_id=f_mod.id, source_id=src.id, external_id=f"mp-{i}",
                            text="Great movie!", created_at=prior))
    for i in range(20):
        session.add(Mention(film_id=f_high.id, source_id=src.id, external_id=f"hp-{i}",
                            text="Amazing film!", created_at=prior))
    session.commit()

    try:
        with _client_with(session) as client:
            data = client.get("/api/v1/trending/films?limit=10").json()
            mod = next(f for f in data if f["film_slug"] == "film-mod")
            high = next(f for f in data if f["film_slug"] == "film-high")
            # sample_size = 30d raw total (recent + prior windows)
            assert mod["sample_size"] == 40
            assert mod["confidence"] == "moderate"
            assert high["sample_size"] == 140
            assert high["confidence"] == "high"
            # Confident copy cites a real platform + a real number
            assert "reddit" in mod["trend_reason"].lower() or "Reddit" in mod["trend_reason"]
            assert "40 signals" in mod["trend_reason"]
            assert "140 signals" in high["trend_reason"]
            # Momentum-driven confident copy may use "Surging"
            assert "surg" in mod["trend_reason"].lower()
            # Driver label names the momentum component
            assert mod["driver_label"] == "Momentum Surge"
            assert high["driver_label"] == "Momentum Surge"
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_platform_never_internal_name():
    """Internal (TMDB) sources must never masquerade as a platform.

    A 3-mention tmdb-only film is insufficient → omitted entirely.  A 30-mention
    tmdb-only film has no real platform to cite: its platform field stays None
    and its copy never claims a platform or the engine's own name.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()

    today = datetime.now(timezone.utc).date()
    f_small = Film(slug="film-tmdb-small", title="Film Internal A", year=2025,
                   release_date=today - timedelta(days=5))
    f_big = Film(slug="film-tmdb-big", title="Film Internal B", year=2025,
                 release_date=today - timedelta(days=5))
    session.add_all([f_small, f_big])
    session.commit()
    snap = datetime.now(timezone.utc)
    session.add_all([
        Ranking(film_id=f_small.id, snapshot_at=snap, rank=1, score=95.0, movement=0,
                ca_score=0.5, momentum_score=0.5, recency_score=0.4, ae_score=0.5, cp_score=0.5),
        Ranking(film_id=f_big.id, snapshot_at=snap, rank=2, score=90.0, movement=0,
                ca_score=0.5, momentum_score=0.5, recency_score=0.4, ae_score=0.5, cp_score=0.5),
    ])
    src = Source(key="tmdb", name="TMDB", weight=1.0)
    session.add(src)
    session.commit()
    now = datetime.now(timezone.utc)
    for i in range(3):
        session.add(Mention(film_id=f_small.id, source_id=src.id, external_id=f"ts-{i}",
                            text="Trailer posted", created_at=now))
    for i in range(30):
        session.add(Mention(film_id=f_big.id, source_id=src.id, external_id=f"tb-{i}",
                            text="Trailer posted", created_at=now))
    session.commit()

    try:
        with _client_with(session) as client:
            data = client.get("/api/v1/trending/films?limit=10").json()
            slugs = {f["film_slug"] for f in data}
            # 3-mention film is insufficient → omitted from the trending feed
            assert "film-tmdb-small" not in slugs
            big = next(f for f in data if f["film_slug"] == "film-tmdb-big")
            assert big["confidence"] == "moderate"
            assert big["top_platform"] is None
            reason = big["trend_reason"].lower()
            assert "audience signals" not in reason
            assert "audience" not in reason
            assert "tmdb" not in reason
            assert "reddit" not in reason and "tiktok" not in reason
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_specificity_cap_downgrades_to_low():
    """A large raw count with nothing specific to cite (no platform, no recent
    activity, no delta baseline) is capped at "low", never confident."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()

    today = datetime.now(timezone.utc).date()
    f = Film(slug="film-old-mentions", title="Old Mentions", year=2025,
             release_date=today - timedelta(days=5))
    session.add(f)
    session.commit()
    snap = datetime.now(timezone.utc)
    session.add(Ranking(film_id=f.id, snapshot_at=snap, rank=1, score=90.0, movement=0,
                        ca_score=0.5, momentum_score=0.5, recency_score=0.4, ae_score=0.5, cp_score=0.5))
    src = Source(key="tmdb", name="TMDB", weight=1.0)
    session.add(src)
    session.commit()
    # All 30 mentions sit just inside the 30-day window but outside the 6-day
    # delta window → 0 in the last 24h, no delta baseline, no real platform.
    old = datetime.now(timezone.utc) - timedelta(days=20)
    for i in range(30):
        session.add(Mention(film_id=f.id, source_id=src.id, external_id=f"o-{i}",
                            text="Trailer posted", created_at=old))
    session.commit()

    try:
        with _client_with(session) as client:
            data = client.get("/api/v1/trending/films?limit=10").json()
            film = next(x for x in data if x["film_slug"] == "film-old-mentions")
            assert film["sample_size"] == 30       # would be "moderate" by count
            assert film["confidence"] == "low"     # capped: nothing specific to cite
            assert film["top_platform"] is None
            assert film["attention_delta_pct"] is None
            reason = film["trend_reason"].lower()
            assert "limited early signal" in reason
            assert "surg" not in reason and "sustains" not in reason
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_headline_eligible_gates_current_activity():
    """A high blended score carried by cross-platform/recency alone must NOT be
    headline-eligible.  The "anchors the Index" claim requires current attention
    (CA_norm) or momentum (M_norm) above the floor, independent of FinalScore.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()

    today = datetime.now(timezone.utc).date()
    # Stale title: highest blended score, but its score is carried by
    # cross-platform reach with zero current attention and no momentum.
    f_stale = Film(slug="film-stale", title="Stale Cross-Platform", year=2025,
                   release_date=today - timedelta(days=30))
    # Active title: lower blended score, but real current attention (CA_norm 0.8).
    f_active = Film(slug="film-active", title="Currently Active", year=2025,
                    release_date=today - timedelta(days=5))
    session.add_all([f_stale, f_active])
    session.commit()
    snap = datetime.now(timezone.utc)
    session.add_all([
        Ranking(film_id=f_stale.id, snapshot_at=snap, rank=1, score=98.5, movement=0,
                ca_score=0.0, momentum_score=0.3, recency_score=0.0,
                ae_score=0.5, cp_score=1.0, sample_size=60, confidence="moderate"),
        Ranking(film_id=f_active.id, snapshot_at=snap, rank=2, score=90.0, movement=0,
                ca_score=0.8, momentum_score=0.5, recency_score=0.3,
                ae_score=0.4, cp_score=0.3, sample_size=60, confidence="moderate"),
    ])
    session.commit()

    try:
        with _client_with(session) as client:
            data = client.get("/api/v1/trending/films?limit=10").json()
            stale = next(f for f in data if f["film_slug"] == "film-stale")
            active = next(f for f in data if f["film_slug"] == "film-active")
            # The stale title still tops the ranked feed by blended score...
            assert stale["rank"] == 1
            assert stale["score"] > active["score"]
            # ...but must not be eligible for the "anchors the Index" headline.
            assert stale["headline_eligible"] is False
            assert active["headline_eligible"] is True
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_trending_empty_when_no_data():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()

    try:
        with _client_with(session) as client:
            response = client.get("/api/v1/trending/films?limit=10")
            assert response.status_code == 200
            assert response.json() == []
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()