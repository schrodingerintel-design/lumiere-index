from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.sql import sqltypes

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    pool_timeout=30,
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


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
