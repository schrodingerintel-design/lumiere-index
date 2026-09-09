"""Startup schema convergence — the backend heals its own database schema.

Deployment reality: the API image can be redeployed (new code) without the
container's ``alembic upgrade head`` having run against the live database (a
custom start command, a platform that doesn't use the Dockerfile CMD, a
migration that failed silently, …). When the schema lags the code, every
query touching the new columns fails with a 5xx and the whole site reads
"unable to load" even though the deploy "succeeded".

This module closes that gap on every boot:

1. **Migrations first** — run ``alembic upgrade head`` in-process. This is the
   canonical path and stamps version history properly. It handles everything
   a normal deploy would (including table creation and index swaps).
2. **Column backfill** — defensively add any columns present on the ORM
   models but missing from the live table. This covers deployments where the
   alembic version table is ahead of the real schema (hand-restored DBs,
   partially-applied migrations) and keeps boot from depending on migration
   bookkeeping being perfectly consistent.

It is idempotent, best-effort (failures are logged, never fatal at boot), and
cheap when everything is already in sync.
"""
from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = logging.getLogger(__name__)


def run_migrations(engine: Engine) -> bool:
    """Apply pending alembic migrations in-process. Returns True on success."""
    try:
        from alembic import command
        from alembic.config import Config

        import os

        # alembic.ini lives at the backend root; resolve relative to this file
        # (backend/app/startup_schema.py → backend/) so it works regardless of
        # the process working directory.
        backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        alembic_ini = os.path.join(backend_root, "alembic.ini")
        if not os.path.exists(alembic_ini):
            log.warning("startup_schema: alembic.ini not found at %s — skipping migrations", alembic_ini)
            return False

        cfg = Config(alembic.ini)
        cfg.set_main_option("script_location", os.path.join(backend_root, "alembic"))
        # Reuse the app's resolved DB URL (env-driven), not alembic.ini's blank one.
        from app.config import settings

        cfg.set_main_option("sqlalchemy.url", settings.resolved_database_url)
        cfg.attributes["configure_logger"] = False
        command.upgrade(cfg, "head")
        log.info("startup_schema: alembic upgrade head complete")
        return True
    except Exception:
        log.exception("startup_schema: alembic upgrade failed (continuing to column backfill)")
        return False


def backfill_missing_columns(engine: Engine) -> list[str]:
    """Add ORM-declared columns that are missing from the live tables.

    Returns the list of ``table.column`` names that were added. Uses each
    column's type as declared on the model so the DDL matches what the ORM
    expects. Nullable-safe: new columns must be nullable (or carry a server
    default) because existing rows have no value for them.
    """
    added: list[str] = []
    try:
        from app.db import Base

        inspector = inspect(engine)
        with engine.begin() as conn:
            for table in Base.metadata.sorted_tables:
                if not inspector.has_table(table.name):
                    continue  # fresh tables are alembic's job
                existing = {c["name"] for c in inspector.get_columns(table.name)}
                for column in table.columns:
                    if column.name in existing:
                        continue
                    col_type = column.type.compile(engine.dialect)
                    ddl = f'ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}'
                    if not column.nullable:
                        # Backfills must not fail on existing rows.
                        ddl += " NULL"
                    conn.execute(text(ddl))
                    added.append(f"{table.name}.{column.name}")
                    log.info("startup_schema: backfilled missing column %s.%s", table.name, column.name)
    except Exception:
        log.exception("startup_schema: column backfill failed")
    return added


def converge(engine: Engine) -> None:
    """Bring the live schema up to the code's expectations. Never raises."""
    try:
        run_migrations(engine)
    except Exception:
        log.exception("startup_schema: migration step errored")
    try:
        backfill_missing_columns(engine)
    except Exception:
        log.exception("startup_schema: backfill step errored")
