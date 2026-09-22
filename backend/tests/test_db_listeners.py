"""Engine listener contract — the production seed warns with a
SADeprecationWarning when any listener uses the legacy
``(dbapi_connection, connection_record, ...)`` engine_connect signature.

These tests pin the SQLAlchemy 2.0 contract:
  * the listener accepts only (conn, **kw) — no deprecation warning fires
  * it fires on a successful connect and closes the DB breaker
  * connection failures do NOT route through engine_connect; they open the
    breaker via handle_error
"""

from __future__ import annotations

import warnings

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import OperationalError

import app.db as db_mod


def test_engine_connect_listener_is_two_point_oh_signature():
    """The registered listener must accept the SA 2.0 (conn, **kw) shape."""
    engine = create_engine("sqlite://")
    listener = db_mod._breaker_on_connect

    # Legacy signature listeners blow up here with a deprecation warning.
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        event.listen(engine, "engine_connect", listener)
        with engine.connect():
            pass

    deprecations = [
        w for w in caught if issubclass(w.category, DeprecationWarning)
    ]
    assert deprecations == [], [w.message for w in deprecations]


def test_engine_connect_closes_breaker_on_success():
    """A successful connect records success with the DB health breaker."""
    engine = create_engine("sqlite://")
    db_mod.db_health.reset_for_tests()
    try:
        event.listen(engine, "engine_connect", db_mod._breaker_on_connect)
        with engine.connect():
            pass
        assert db_mod.db_health.is_open() is False
    finally:
        db_mod.db_health.reset_for_tests()


def test_dbapi_connect_failure_opens_breaker_via_handle_error():
    """A real DBAPI connect failure (production's outage shape) routes
    through handle_error and opens the breaker. engine_connect never sees
    failures under SA 2.0 — verified empirically against 2.0.35."""
    import sqlite3

    engine = create_engine("sqlite://")
    db_mod.db_health.reset_for_tests()

    def failing_connect(dbapi_conn, rec):
        raise sqlite3.OperationalError("unable to open database file")

    try:
        event.listen(engine, "connect", failing_connect)
        event.listen(engine, "engine_connect", db_mod._breaker_on_connect)
        event.listen(engine, "handle_error", db_mod._breaker_on_error)
        with pytest.raises(OperationalError):
            engine.connect()
        assert db_mod.db_health.is_open() is True
    finally:
        db_mod.db_health.reset_for_tests()


def test_handle_error_ignores_sql_level_errors():
    """ProgrammingError-style app bugs must not open the outage breaker."""
    from sqlalchemy.exc import ProgrammingError

    class FakeContext:
        original_exception = ProgrammingError("stmt", {}, "bad sql")

    db_mod.db_health.reset_for_tests()
    try:
        db_mod._breaker_on_error(FakeContext())
        assert db_mod.db_health.is_open() is False
    finally:
        db_mod.db_health.reset_for_tests()
