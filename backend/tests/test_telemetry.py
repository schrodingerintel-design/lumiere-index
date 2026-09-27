"""Tests for the client-error telemetry endpoint (temporary observability).

Contract under test:
  * happy path stores a report and answers 202 {"ok": true, "stored": true};
  * payload fields are sanitized (control chars stripped, truncated) and ONLY
    the allow-listed fields survive — an extra field is dropped;
  * the endpoint never 500s: a poisoned session degrades to stored=False;
  * a dedicated per-IP rate limit backstops the global limiter;
  * the readout endpoint is admin-key protected (public API must not expose
    error reports);
  * structured stdout line contains the incident id for log correlation.
"""
from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from app.api.v1 import telemetry as telemetry_mod
from app.models import ClientErrorReport


@pytest.fixture(autouse=True)
def _reset_rate_store():
    telemetry_mod._rate_store.clear()
    yield
    telemetry_mod._rate_store.clear()


def _payload(**overrides) -> dict:
    base = {
        "phase": "boundary",
        "incidentId": "TESTABCD",
        "clientTimestamp": "2026-09-27T07:00:00.000Z",
        "buildId": "index-DIAG1.js",
        "route": "/top-100",
        "errorName": "TypeError",
        "errorMessage": "Failed to fetch dynamically imported module: /assets/index-DIAG1.js",
        "errorStack": "TypeError: boom at index-DIAG1.js:1:1",
        "chunkMatched": True,
        "chunkSignature": "dynamic_import_fetch_failed#/assets/index-DIAG1.js",
        "recoveryAttempts": 2,
        "recoveryState": "attempted",
        "online": True,
        "uaFamily": "Edge",
        "afterRetry": False,
        "retryAction": None,
    }
    base.update(overrides)
    return base


def test_post_stores_report_and_answers_202(client: TestClient, db_session):
    resp = client.post("/api/v1/telemetry/client-error", json=_payload())
    assert resp.status_code == 202
    body = resp.json()
    assert body["ok"] is True
    assert body["stored"] is True

    rows = db_session.query(ClientErrorReport).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.incident_id == "TESTABCD"
    assert row.build_id == "index-DIAG1.js"
    assert row.chunk_matched is True
    assert row.ua_family == "Edge"
    assert row.phase == "boundary"


def test_extra_fields_are_dropped_not_stored(client: TestClient, db_session):
    hostile = _payload(ipAddress="203.0.113.9", cookie="session=steal", token="hunter2")
    resp = client.post("/api/v1/telemetry/client-error", json=hostile)
    assert resp.status_code == 202

    row = db_session.query(ClientErrorReport).first()
    dumped = {c: getattr(row, c) for c in row.__table__.columns.keys()}
    assert "ipAddress" not in dumped
    assert all("steal" not in str(v) and "hunter2" not in str(v) for v in dumped.values())


def test_control_chars_stripped_and_long_input_truncated(client: TestClient, db_session):
    resp = client.post(
        "/api/v1/telemetry/client-error",
        json=_payload(errorStack="bad\x00\x1fstack " + "x" * 5000),
    )
    assert resp.status_code == 202
    row = db_session.query(ClientErrorReport).first()
    assert "\x00" not in (row.error_stack or "")
    assert "\x1f" not in (row.error_stack or "")
    assert len(row.error_stack) <= 2000


def test_ua_header_parsed_to_family_only(client: TestClient, db_session):
    resp = client.post(
        "/api/v1/telemetry/client-error",
        json=_payload(uaFamily=None),
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/126.0.0.0"},
    )
    assert resp.status_code == 202
    row = db_session.query(ClientErrorReport).first()
    assert row.ua_family == "Edge"


def test_persistence_failure_is_non_fatal(client: TestClient, db_session, monkeypatch):
    def broken_commit(self):
        raise RuntimeError("db gone")

    monkeypatch.setattr(type(db_session), "commit", broken_commit)
    resp = client.post("/api/v1/telemetry/client-error", json=_payload())
    assert resp.status_code == 202
    assert resp.json()["stored"] is False


def test_rate_limit_rejects_flood(client: TestClient, db_session):
    for _ in range(telemetry_mod.TELEMETRY_RATE_LIMIT):
        assert client.post("/api/v1/telemetry/client-error", json=_payload()).status_code == 202
    resp = client.post("/api/v1/telemetry/client-error", json=_payload())
    assert resp.json()["ok"] is False
    assert resp.json()["reason"] == "rate_limited"
    # Counted rows stay at the accepted count, not the flood size.
    assert db_session.query(ClientErrorReport).count() == telemetry_mod.TELEMETRY_RATE_LIMIT


def test_structured_log_contains_incident_id(client: TestClient, db_session, monkeypatch):
    """caplog can't see records here (setup_logging reconfigures handlers), so
    spy on the module logger directly."""
    seen: list[str] = []
    original_info = telemetry_mod.log.info
    monkeypatch.setattr(telemetry_mod.log, "info", lambda msg, *a: seen.append(msg % a if a else msg))
    try:
        client.post("/api/v1/telemetry/client-error", json=_payload(incidentId="LOGTEST1"))
    finally:
        monkeypatch.setattr(telemetry_mod.log, "info", original_info)
    assert any("LOGTEST1" in line and "[client-error]" in line for line in seen)


def test_admin_readout_requires_key(client: TestClient):
    assert client.get("/api/v1/telemetry/client-error/recent").status_code == 403
    assert (
        client.get(
            "/api/v1/telemetry/client-error/recent", headers={"X-Admin-Key": "wrong"}
        ).status_code
        == 403
    )


def test_admin_readout_with_key(client: TestClient, db_session, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "admin_key", "test-admin-key")
    client.post("/api/v1/telemetry/client-error", json=_payload(incidentId="READOUT1"))
    resp = client.get(
        "/api/v1/telemetry/client-error/recent", headers={"X-Admin-Key": "test-admin-key"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1
    assert any(r["incidentId"] == "READOUT1" for r in data["reports"])


def test_invalid_payload_rejected(client: TestClient):
    resp = client.post("/api/v1/telemetry/client-error", json={"incidentId": 12345})
    assert resp.status_code == 422
