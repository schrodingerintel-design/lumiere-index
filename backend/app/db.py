import logging

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.sql import sqltypes

from app.config import settings
from app.services import db_health

log = logging.getLogger(__name__)


def _mysql_connect_args(settings) -> dict:
    """Dialect-appropriate timeouts. SQLite (tests) gets none; PyMySQL gets
    aggressive connect/read/write timeouts so requests fail fast instead of
    hanging when the database is unreachable."""
    url = settings.resolved_database_url
    if url.startswith("sqlite"):
        return {}
    return {"connect_timeout": 5, "read_timeout": 15, "write_timeout": 15}


engine = create_engine(
    settings.resolved_database_url,
    pool_pre_ping=True,
    # Small single-node MySQL (Railway): a modest pool with fast failure beats
    # a big pool that queues. Connect/read timeouts stop a dead DB from
    # holding API workers for minutes (the 20-40s TTFB failure signature).
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
    pool_timeout=10,
    connect_args=_mysql_connect_args(settings),
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


# ── Outage circuit breaker ──────────────────────────────────────────────────
# Engine-level listeners feed the breaker (app/services/db_health.py): a
# connection-level exception opens it, a successful connection or checkout
# closes it. While it is open, the API middleware answers 503 instantly
# instead of walking the TCP timeout ladder per request.
@event.listens_for(engine, "checkout")
def _breaker_on_checkout(dbapi_conn, record, cursor):
    """A connection was handed out successfully — the DB is answering."""
    db_health.record_success()


@event.listens_for(engine, "engine_connect")
def _breaker_on_connect(conn, **kw):
    """A fresh Connection was produced successfully.

    SQLAlchemy 2.0 signature: the event receives only the connection and is
    invoked on success only. Connection failures dispatch to handle_error
    (above), which opens the breaker; this closes it.
    """
    db_health.record_success()


@event.listens_for(engine, "handle_error")
def _breaker_on_error(context):
    """Open the breaker on connection-level failures (not SQL-level ones)."""
    from sqlalchemy.exc import InterfaceError, OperationalError

    # handle_error carries the RAW DBAPI exception in original_exception
    # (e.g. pymysql.err.OperationalError), which is NOT a subclass of the
    # SQLAlchemy wrapper classes. The wrapped forms live on
    # sqlalchemy_exception / chained_exception — check all three so outage
    # signatures (connect refused/timeout, dropped connections) are caught
    # no matter which shape surfaces. Non-DBAPI errors (app bugs like a
    # bad query) never match and must not trip the breaker.
    # (chained_exception is a declared-but-unset slot on some SA 2.0.x
    # builds; getattr keeps this tolerant of the context shape.)
    candidates = (
        getattr(context, "sqlalchemy_exception", None),
        getattr(context, "chained_exception", None),
        getattr(context, "original_exception", None),
    )
    for exc in candidates:
        if isinstance(exc, (OperationalError, InterfaceError)):
            db_health.record_failure(f"{type(exc).__name__}: {str(exc)[:200]}")
            return


class Base(DeclarativeBase):
    pass


@event.listens_for(Base.metadata, "before_create")
def _sqlite_bigint_pk(target, connection, **kw):
    """SQLite can't autoincrement a BIGINT primary key, only INTEGER.

    This keeps the tests (which run on in-memory SQLite) able to insert rows
    without explicit ids; production MySQL keeps the BIGINT columns.
    """
    if connection.dialect.name != "sqlite":
        return
    for table in target.tables.values():
        for col in table.columns:
            if col.primary_key and isinstance(col.type, sqltypes.BigInteger):
                col.type = sqltypes.INTEGER()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
