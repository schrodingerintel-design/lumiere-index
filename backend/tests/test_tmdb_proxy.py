"""Tests for the TMDB proxy retry/backoff behavior and graceful failures.

These never hit the real TMDB API — httpx is mocked so we can simulate
transient DNS failures, timeouts, rate limits, and persistent outages.
"""
import httpx
import pytest
from fastapi import HTTPException

from app.api.v1 import tmdb_proxy as tp


@pytest.fixture(autouse=True)
def _fake_api_key(monkeypatch):
    """conftest blanks the real key to keep the suite offline; give the proxy one."""
    monkeypatch.setattr(tp.settings, "tmdb_api_key", "test-key")


class _FakeResponse:
    def __init__(self, status_code: int = 200, payload=None, headers=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.headers = headers or {}
        self.text = f"fake error {status_code}"
        self.request = None

    def json(self):
        return self._payload


def _patch_client(monkeypatch, handler):
    """Make httpx.AsyncClient.get return whatever `handler(url, params)` returns."""

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url, params):
            return await handler(url, params)

    monkeypatch.setattr(httpx, "AsyncClient", _FakeClient)


@pytest.mark.asyncio
async def test_retries_transient_connect_errors_then_succeeds(monkeypatch):
    calls = {"n": 0}

    async def handler(url, params):
        calls["n"] += 1
        if calls["n"] < 3:
            raise httpx.ConnectError("getaddrinfo failed")
        return _FakeResponse(200, {"ok": True})

    _patch_client(monkeypatch, handler)
    result = await tp._proxy_get("/search/movie", {"query": "test"})
    assert result == {"ok": True}
    assert calls["n"] == 3  # two failures + one success


@pytest.mark.asyncio
async def test_retries_timeouts(monkeypatch):
    calls = {"n": 0}

    async def handler(url, params):
        calls["n"] += 1
        raise httpx.ConnectTimeout("timed out")

    _patch_client(monkeypatch, handler)
    with pytest.raises(HTTPException) as exc_info:
        await tp._proxy_get("/search/movie", {"query": "test"})
    assert exc_info.value.status_code == 503
    assert calls["n"] == tp._MAX_ATTEMPTS


@pytest.mark.asyncio
async def test_persistent_outage_returns_graceful_503(monkeypatch):
    calls = {"n": 0}

    async def handler(url, params):
        calls["n"] += 1
        raise httpx.ConnectError("getaddrinfo failed")

    _patch_client(monkeypatch, handler)
    with pytest.raises(HTTPException) as exc_info:
        await tp._proxy_get("/search/movie", {"query": "test"})
    assert exc_info.value.status_code == 503
    assert "unavailable" in exc_info.value.detail
    assert calls["n"] == tp._MAX_ATTEMPTS


@pytest.mark.asyncio
async def test_rate_limit_429_honors_retry_after_then_succeeds(monkeypatch):
    calls = {"n": 0}

    async def handler(url, params):
        calls["n"] += 1
        if calls["n"] == 1:
            return _FakeResponse(429, headers={"retry-after": "0"})
        return _FakeResponse(200, {"ok": True})

    _patch_client(monkeypatch, handler)
    result = await tp._proxy_get("/search/movie", {"query": "test"})
    assert result == {"ok": True}
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_exhausted_429_returns_503(monkeypatch):
    async def handler(url, params):
        return _FakeResponse(429, headers={"retry-after": "0"})

    _patch_client(monkeypatch, handler)
    with pytest.raises(HTTPException) as exc_info:
        await tp._proxy_get("/search/movie", {"query": "test"})
    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_non_transient_error_passes_through_immediately(monkeypatch):
    # 401 (bad key) / 404 (unknown movie) must NOT be retried or masked.
    async def handler(url, params):
        return _FakeResponse(401, {"status_message": "Invalid API key"})

    _patch_client(monkeypatch, handler)
    with pytest.raises(HTTPException) as exc_info:
        await tp._proxy_get("/search/movie", {"query": "test"})
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_success_without_retries(monkeypatch):
    calls = {"n": 0}

    async def handler(url, params):
        calls["n"] += 1
        return _FakeResponse(200, {"ok": True})

    _patch_client(monkeypatch, handler)
    result = await tp._proxy_get("/search/movie", {"query": "test"})
    assert result == {"ok": True}
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_backoff_delay_is_bounded(monkeypatch):
    # Retry-After larger than our cap must be clamped, never slept for minutes.
    assert tp._retry_delay(1, "9999") <= 5.25


@pytest.mark.asyncio
async def test_missing_api_key_is_503(monkeypatch):
    async def handler(url, params):
        raise AssertionError("must not hit the network")

    _patch_client(monkeypatch, handler)
    monkeypatch.setattr(tp.settings, "tmdb_api_key", "")
    with pytest.raises(HTTPException) as exc_info:
        await tp._proxy_get("/search/movie", {"query": "test"})
    assert exc_info.value.status_code == 503
