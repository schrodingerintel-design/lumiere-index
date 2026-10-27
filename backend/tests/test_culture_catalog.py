"""Catalog identity, outage isolation, attribution, and evidence thresholds."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

import pytest
from fastapi import HTTPException, Response
from fastapi.testclient import TestClient

from app.api.v1 import culture, tmdb_proxy


def test_curated_reference_identities_match_frontend():
    frontend = Path(__file__).parents[2] / "lumiere-the-index-codebase/src/data/culture.json"
    if not frontend.exists():
        pytest.skip("Frontend sources are not included in the backend container")
    entries = json.loads(frontend.read_text(encoding="utf-8"))
    assert len(entries) == len({entry["slug"] for entry in entries})
    assert {entry["slug"]: entry["wiki"] for entry in entries} == culture.REGISTRY
    assert all(entry["related"] in culture.REGISTRY for entry in entries)


@pytest.mark.asyncio
async def test_unknown_culture_identity_never_calls_upstream(monkeypatch):
    async def fail(_):
        pytest.fail("Unknown article must not be fetched")
    monkeypatch.setattr(culture, "_enrich", fail)
    with pytest.raises(HTTPException) as error:
        await culture.culture_profile("not-a-curated-profile", Response())
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_reference_cache_deduplicates_concurrent_reads(monkeypatch):
    import asyncio
    culture._cache.clear()
    calls = []
    async def enrich(slug):
        calls.append(slug)
        await asyncio.sleep(0)
        return {"slug": slug, "image_url": None}
    monkeypatch.setattr(culture, "_enrich", enrich)
    await asyncio.gather(*(culture.culture_profile("hades", Response()) for _ in range(5)))
    assert calls == ["hades"]
    culture._cache.clear()


def test_attribution_is_plain_text():
    assert culture.plain('<a href="https://example.org">Photographer &amp; Studio</a>') == "Photographer & Studio"


def test_catalog_remains_accessible_during_database_outage(monkeypatch):
    from app.main import app
    from app.services import db_health
    monkeypatch.setattr(db_health, "is_open", lambda: True)
    async def cached(path, params=None, ttl=1800):
        return {"results": [{"id": 31, "name": "Catalog person"}], "page": 1}
    monkeypatch.setattr(tmdb_proxy, "_cached_get", cached)
    client = TestClient(app)  # No lifespan, migrations, scheduler, or DB.
    assert client.get("/api/v1/tmdb/trending/person/week").status_code == 200
    assert client.get("/api/v1/films/top").status_code == 503
    assert client.get("/api/v1/tmdb/trending/not-a-type/week").status_code == 422


def test_sentiment_requires_recent_real_text_sample(db_session):
    from app.api.v1.films import film_detail
    from app.models import Mention, Source
    source = Source(key="reviews-test", name="Reviews", weight=1.0)
    db_session.add(source)
    db_session.flush()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    def mention(identity, at=now, text="A good film"):
        return Mention(id=1000+len(identity)+sum(map(ord,identity)), film_id=1, source_id=source.id,
                       external_id=identity, created_at=at, text=text,
                       sentiment_label="positive", sentiment_score=0.9)
    db_session.add(mention("single-real-review"))
    db_session.commit()
    result = film_detail("mickey-17", db_session)
    assert result.sentiment.sample_size == 1
    assert result.sentiment.sufficient_data is False
    assert result.sentiment.positive is None
    # A demo row and an old review cannot change the recent sample.
    db_session.add_all([mention("seed_old-demo"), mention("too-old", now-timedelta(days=40))])
    db_session.commit()
    assert film_detail("mickey-17", db_session).sentiment.sample_size == 1
    for i in range(19):
        db_session.add(Mention(id=20000+i, film_id=1, source_id=source.id, external_id=f"review-{i}",
                               created_at=now, text="A written review", sentiment_label="positive", sentiment_score=0.8))
    db_session.commit()
    result = film_detail("mickey-17", db_session)
    assert result.sentiment.sample_size == 20
    assert result.sentiment.sufficient_data is True
    assert result.sentiment.window_days == 30


def test_production_seed_requires_explicit_demo_mode(monkeypatch):
    import seed
    monkeypatch.delenv("LUMIERE_DEMO_DATA", raising=False)
    monkeypatch.setattr(seed, "SessionLocal", lambda: pytest.fail("Production must not seed demo data"))
    seed.run()


@pytest.mark.asyncio
async def test_adult_catalog_detail_is_not_exposed(monkeypatch):
    async def cached(*args, **kwargs):
        return {"id": 1, "adult": True}
    monkeypatch.setattr(tmdb_proxy, "_cached_get", cached)
    for endpoint in (tmdb_proxy.movie_details, tmdb_proxy.tv_details):
        with pytest.raises(HTTPException) as error:
            await endpoint(1)
        assert error.value.status_code == 404


def test_people_publication_does_not_trust_provider_adult_flag_alone():
    from app.services.catalog_publication import public_person
    base = {"id": 1, "name": "Example", "adult": False,
            "combined_credits": {"cast": [{"title": "A film", "adult": False, "vote_count": 100}]}}
    assert public_person({**base, "biography": "An actor known for film and television."})
    assert not public_person({**base, "biography": "An adult film actress."})
    assert not public_person({**base, "adult": True})
    assert not public_person({"name": "No catalog evidence", "biography": "An actor."})


@pytest.mark.asyncio
async def test_trending_and_search_omit_unpublishable_people(monkeypatch):
    async def details(person_id):
        if person_id == 2:
            raise HTTPException(404, "Profile unavailable")
        return {"id": person_id, "combined_credits": {"cast": [{"title": "Film", "vote_count": 100}]}}
    monkeypatch.setattr(tmdb_proxy, "person_details", details)
    data = {"results": [{"id": 1, "media_type": "person"}, {"id": 2, "media_type": "person"},
                        {"id": 3, "media_type": "movie", "adult": False}]}
    result = await tmdb_proxy._publication_page(data)
    assert [item["id"] for item in result["results"]] == [1, 3]
