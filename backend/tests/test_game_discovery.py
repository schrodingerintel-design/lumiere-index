from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from app.services import game_discovery as games
from app.services.editorial_schedule import claim_news_window


@pytest.fixture(autouse=True)
def isolated(monkeypatch, tmp_path):
    monkeypatch.setenv("LUMIERE_GAMES_CACHE_PATH", str(tmp_path / "games.json"))
    monkeypatch.setattr(games, "_snapshot", None)
    monkeypatch.setattr(games, "_retry_after", 0)
    monkeypatch.setattr(games.settings, "rawg_api_key", SecretStr("test-only"))


def test_ai_rejects_invented_and_duplicate_games():
    candidates = [{"id": 1}, {"id": 2}]
    for values in ([1, 999], [1, 1], [1]):
        with pytest.raises(ValueError):
            games.validate_order(games.GameOrder(game_ids=values), candidates)
    games.validate_order(games.GameOrder(game_ids=[2, 1]), candidates)


def test_scheduled_categories_are_separated(db_session):
    now = datetime(2026, 11, 1, tzinfo=timezone.utc)
    claim_news_window(db_session, now=now)
    with pytest.raises(HTTPException):
        claim_news_window(db_session, now=now + timedelta(hours=5), task="games")
    claim_news_window(db_session, now=now + timedelta(hours=6), task="games")
    with pytest.raises(HTTPException):
        claim_news_window(db_session, now=now + timedelta(hours=72), task="games")
    claim_news_window(db_session, now=now + timedelta(hours=78), task="games")


@pytest.mark.asyncio
async def test_visitors_share_snapshot_without_ai_calls(monkeypatch):
    calls = []
    original = httpx.AsyncClient

    def handle(request):
        calls.append(request.url.host)
        assert request.url.params["page_size"] == "40"
        return httpx.Response(200, json={"results": [{"id": 1, "slug": "sample-game", "name": "Sample Game", "added": 50}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs))
    async def forbidden(*args, **kwargs):
        pytest.fail("A visitor must never trigger AI generation")
    monkeypatch.setattr(games.editorial_ai, "generate_json", forbidden)
    first = await games.games_snapshot()
    monkeypatch.setattr(games, "_snapshot", None)  # Reload persisted package after restart.
    second = await games.games_snapshot()
    assert first == second
    assert calls == ["api.rawg.io"]
    assert first["ordering"] == "catalog_popularity"
    assert "key" not in str(first)


@pytest.mark.asyncio
async def test_failure_is_generic_and_does_not_retry_on_each_view(monkeypatch):
    calls = []
    original = httpx.AsyncClient
    def handle(request):
        calls.append(1)
        return httpx.Response(401, json={"error": "private provider detail"})
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs))
    for _ in range(2):
        with pytest.raises(HTTPException) as error:
            await games.games_snapshot()
        assert error.value.status_code == 503
        assert "private" not in error.value.detail
    assert len(calls) == 1


def test_image_urls_are_restricted():
    assert games.image_url("https://media.rawg.io/media/a.jpg")
    assert games.image_url("https://evil.example/a.jpg") is None
    assert games.image_url("javascript:alert(1)") is None


@pytest.mark.asyncio
async def test_scheduler_applies_validated_ai_order(monkeypatch, db_session):
    now = datetime.now(timezone.utc)
    candidates = [games.normalize_game({"id": i, "slug": f"game-{i}", "name": f"Game {i}"}) for i in (1, 2)]
    games.save_snapshot({"version": 1, "items": candidates, "ordering": "catalog_popularity", "updated_at": now.isoformat(), "next_refresh_at": (now + timedelta(hours=72)).isoformat()})
    monkeypatch.setattr(games.editorial_ai, "configured", lambda: True)
    async def generate(*args, **kwargs):
        assert args[0] == "games"
        assert {item["id"] for item in args[2]["games"]} == {1, 2}
        return games.GameOrder(game_ids=[2, 1])
    monkeypatch.setattr(games.editorial_ai, "generate_json", generate)
    assert await games.rank_games(db_session) == 2
    assert [game["id"] for game in games.load_snapshot()["items"]] == [2, 1]
    assert games.load_snapshot()["ordering"] == "ai_editorial"
    with pytest.raises(HTTPException):
        await games.rank_games(db_session)
