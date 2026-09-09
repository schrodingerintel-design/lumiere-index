"""Startup schema convergence — the backend heals its own database schema.

Deployment reality: the API image can be redeployed (new code) without the
container's ``alembic upgrade head`` having run against the live database (a
custom start command, a platform that doesn't use the Dockerfile CMD, a
migration that failed silently, a DB that was created via create_all and has
no migration history at all, …). When the schema lags the code, every query
touching the new columns fails with a 5xx and the whole site reads "unable
to load" even though the deploy "succeeded".

This module closes that gap on every boot:

1. **Migrate or stamp** — run ``alembic upgrade head`` in-process. If the DB
   has real tables but NO migration history (create_all origin), replaying
   history would hard-fail on ``CREATE TABLE films`` — so instead we stamp
   head and let the column backfill below converge the schema.
2. **Column backfill** — add any ORM-declared columns missing from live
   tables. Columns get their model default in the DDL where available, and
   existing NULL rows are updated to that default (e.g. ``content_type`` →
   ``'MOVIE'``), so serialized rows always satisfy the API contracts.

Idempotent, best-effort (failures are logged, never fatal at boot), and
cheap when everything is already in sync.
"""
from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = logging.getLogger(__name__)


def _alembic_config():
    """Build an alembic Config rooted at the backend directory."""
    import os

    from alembic.config import Config

    from app.config import settings

    # alembic.ini lives at the backend root; resolve relative to this file
    # (backend/app/startup_schema.py → backend/) so it works regardless of
    # the process working directory.
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_ini = os.path.join(backend_root, "alembic.ini")
    if not os.path.exists(alembic_ini):
        log.warning("startup_schema: alembic.ini not found at %s — skipping migrations", alembic_ini)
        return None
    cfg = Config(alembic_ini)
    cfg.set_main_option("script_location", os.path.join(backend_root, "alembic"))
    # Reuse the app's resolved DB URL (env-driven), not alembic.ini's blank one.
    cfg.set_main_option("sqlalchemy.url", settings.resolved_database_url)
    cfg.attributes["configure_logger"] = False
    return cfg


def run_migrations(engine: Engine) -> bool:
    """Apply pending alembic migrations (or stamp a history-less DB).

    Returns True when the schema is believed to be migration-consistent.
    """
    from alembic import command

    cfg = _alembic_config()
    if cfg is None:
        return False
    try:
        insp = inspect(engine)
        tables = set(insp.get_table_names())
        has_history = "alembic_version" in tables
        has_data = "films" in tables

        if not has_history and has_data:
            # DB was created outside alembic (create_all / manual). Replaying
            # migration history would fail on existing tables; stamp head and
            # let the column backfill converge the schema instead.
            command.stamp(cfg, "head")
            log.info("startup_schema: no alembic history but tables exist — stamped head")
            return True

        command.upgrade(cfg, "head")
        log.info("startup_schema: alembic upgrade head complete")
        return True
    except Exception:
        log.exception("startup_schema: alembic step failed (continuing to column backfill)")
        return False


def _scalar_default(column) -> str | None:
    """Best-effort SQL literal for a column's model-level default."""
    for default in (column.server_default, column.default):
        if default is None:
            continue
        arg = getattr(default, "arg", None)
        if isinstance(arg, str):
            return "'" + arg.replace("'", "''") + "'"
        if isinstance(arg, (int, float)):
            return str(arg)
    return None


def backfill_missing_columns(engine: Engine) -> list[str]:
    """Add ORM-declared columns that are missing from the live tables.

    A column declared NOT NULL (or carrying a default) is added with that
    default and existing NULL rows are updated to it — a bare nullable add
    would leave every row NULL and fail API serialization downstream.
    Returns the list of ``table.column`` names that were added.
    """
    added: list[str] = []
    try:
        from app.db import Base

        # Phase 1 — reflect the plan and CLOSE the connection before writing.
        # A live inspector holding a pooled connection (StaticPool reuses one
        # DBAPI connection!) must never overlap with the write connection, or
        # transactional state interleaves and later statements vanish.
        plan: list[tuple[str, str, str | None, bool]] = []
        inspector = inspect(engine)
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue  # fresh tables are alembic's job
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                plan.append(
                    (
                        table.name,
                        f"ALTER TABLE {table.name} ADD COLUMN {column.name} "
                        f"{column.type.compile(engine.dialect)}",
                        _scalar_default(column),
                        bool(column.nullable),
                    )
                )
        del inspector

        # Phase 2 — apply each ALTER + default UPDATE in its own transaction.
        for table_name, ddl, default_sql, nullable in plan:
            with engine.begin() as conn:
                conn.execute(text(ddl))
                if default_sql is not None:
                    conn.execute(
                        text(
                            f"UPDATE {table_name} SET {ddl.split('ADD COLUMN ')[1].split(' ')[0]} "
                            f"= {default_sql} WHERE {ddl.split('ADD COLUMN ')[1].split(' ')[0]} IS NULL"
                        )
                    )
            column_name = ddl.split("ADD COLUMN ")[1].split(" ")[0]
            added.append(f"{table_name}.{column_name}")
            log.info("startup_schema: backfilled missing column %s.%s", table_name, column_name)

            if default_sql is None and not nullable:
                # No usable default and NOT NULL in the model — leave the
                # column nullable rather than let row updates fail.
                log.warning(
                    "startup_schema: %s.%s backfilled without a default "
                    "(model declares NOT NULL); rows keep NULL",
                    table_name,
                    column_name,
                )
    except Exception:
        log.exception("startup_schema: column backfill failed")
    return added


def normalize_null_defaults(engine: Engine) -> list[str]:
    """Update NULL rows to the model default for columns that carry one.

    Heals databases where a previous deploy added a NOT-NULL-with-default
    column as a bare nullable add (leaving every existing row NULL) — those
    NULLs would then fail API serialization even though the schema "looks"
    complete. Idempotent: affects zero rows once data is healthy.
    """
    normalized: list[str] = []
    try:
        from app.db import Base

        # Reflect first with a closed-out connection (see backfill note), then
        # apply one UPDATE per column in its own transaction.
        updates: list[tuple[str, str, str]] = []
        inspector = inspect(engine)
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name not in existing:
                    continue
                default_sql = _scalar_default(column)
                if default_sql is None:
                    continue
                updates.append((table.name, column.name, default_sql))
        del inspector

        for table_name, column_name, default_sql in updates:
            with engine.begin() as conn:
                result = conn.execute(
                    text(
                        f"UPDATE {table_name} SET {column_name} = {default_sql} "
                        f"WHERE {column_name} IS NULL"
                    )
                )
                rowcount = result.rowcount
            if rowcount:
                normalized.append(f"{table_name}.{column_name}={rowcount}")
                log.info(
                    "startup_schema: normalized %d NULL rows in %s.%s to %s",
                    rowcount, table_name, column_name, default_sql,
                )
    except Exception:
        log.exception("startup_schema: default normalization failed")
    return normalized


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
    try:
        normalize_null_defaults(engine)
    except Exception:
        log.exception("startup_schema: default normalization errored")
