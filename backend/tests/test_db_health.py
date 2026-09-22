"""DB outage circuit breaker — behavior tests.

The breaker exists so a dead MySQL produces instant 503s instead of every
request hanging on the TCP timeout (the 2026-09-20 outage signature), and so
health probes are never blocked (a 503 /healthz would get the healthy
container restarted).
"""

import pytest

from app.services import db_health


@pytest.fixture(autouse=True)
def _reset_breaker():
    db_health.reset_for_tests()
    yield
    db_health.reset_for_tests()


# ── breaker lifecycle ────────────────────────────────────────────────────────


def test_breaker_closed_by_default():
    assert db_health.is_open() is False


def test_failure_opens_and_success_closes():
    db_health.record_failure("test: simulated")
    assert db_health.is_open() is True
    db_health.record_success()
    assert db_health.is_open() is False


def test_half_open_after_reset_window(monkeypatch):
    clock = {"t": 1000.0}
    monkeypatch.setattr(db_health.time, "monotonic", lambda: clock["t"])
    db_health.record_failure("test: simulated")  # opens at t=1000
    assert db_health.is_open() is True
    clock["t"] += 31.0  # age past the reset window
    assert db_health.is_open() is False  # half-open: one probe allowed
    db_health.record_failure("test: probe failed")  # probe failed → re-open
    assert db_health.is_open() is True


def test_repeated_failures_do_not_reset_timer_backward():
    """A failure while open keeps the breaker open (idempotent)."""
    db_health.record_failure("first")
    db_health.record_failure("second")
    assert db_health.is_open() is True


# ── middleware fast-fail ─────────────────────────────────────────────────────


def test_middleware_returns_503_when_breaker_open(client):
    db_health.record_failure("test: outage")
    resp = client.get("/api/v1/films/top")
    assert resp.status_code == 503
    assert "unavailable" in resp.json()["detail"].lower()
    assert resp.headers.get("retry-after") == "30"


def test_middleware_never_blocks_health_probes(client):
    db_health.record_failure("test: outage")
    # Liveness must stay 200 even mid-outage, or Railway restarts the
    # perfectly healthy API container.
    assert client.get("/healthz").status_code == 200
    assert client.get("/health").status_code == 200
    # readyz does its own DB check and reports the real status (503 + detail).
    r = client.get("/readyz")
    assert r.status_code in (200, 503)
    assert r.json()["db"] in ("ok", "unreachable")


def test_middleware_passes_through_when_breaker_closed(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200


# ── engine listener integration ──────────────────────────────────────────────


def test_engine_listeners_drive_breaker(db_session):
    """The engine listeners wired in app/db.py map to breaker transitions."""
    # The listeners attach to the production engine (MySQL); invoke them
    # directly to lock the wiring contract.
    from app import db as db_module

    db_health.record_failure("test: outage")
    assert db_health.is_open() is True

    db_module._breaker_on_checkout(object(), None, None)  # successful checkout
    assert db_health.is_open() is False

    db_module._breaker_on_connect(object())  # fresh connect (SA 2.0: conn only)
    assert db_health.is_open() is False


def test_error_listener_ignores_sql_level_errors():
    """ProgrammingError is an app bug, not an outage — must NOT open the breaker."""
    from sqlalchemy.exc import ProgrammingError

    class _Ctx:
        original_exception = ProgrammingError("SELECT bad", {}, Exception("no such column"))

    from app import db as db_module

    db_module._breaker_on_error(_Ctx())
    assert db_health.is_open() is False


def test_error_listener_opens_on_connection_errors():
    from sqlalchemy.exc import InterfaceError, OperationalError

    class _CtxOp:
        original_exception = OperationalError(
            "SELECT 1", {}, Exception("Can't connect to MySQL server on 'mysql.railway.internal' (timed out)")
        )

    class _CtxIf:
        original_exception = InterfaceError("SELECT 1", {}, Exception("connection closed"))

    from app import db as db_module

    db_module._breaker_on_error(_CtxOp())
    assert db_health.is_open() is True
    db_health.reset_for_tests()

    db_module._breaker_on_error(_CtxIf())
    assert db_health.is_open() is True
