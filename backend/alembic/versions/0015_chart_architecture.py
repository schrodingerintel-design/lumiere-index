"""Chart architecture: chart_type on all rank/snapshot tables.

Revision ID: 0015_chart_architecture
Revises: 0014_backfill_genre_tags
Create Date: 2026-09-19

Phase 1 of The Index chart re-architecture:

  * `rankings` gains chart_type (rank is ALWAYS contextual to a chart) and
    composite_raw (internal pre-scale momentum, admin-inspector only).
  * daily/weekly snapshot tables and index_debuts gain chart_type; their
    unique constraints become chart-scoped.
  * Per the migration contract (§27): existing published history stays as
    chart_type "MOVIE_100" (the old mixed chart genuinely was the movie
    chart for its lifetime) and every historical row is preserved.  No
    historical TV_100 / ACTOR_100 / DIRECTOR_100 rows are fabricated —
    their chart history begins with their actual launch.
"""
from alembic import op
import sqlalchemy as sa

revision = "0015_chart_architecture"
down_revision = "0014_backfill_genre_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── continuous computation layer ────────────────────────────────────────
    op.add_column("rankings", sa.Column("chart_type", sa.String(length=16), server_default="MOVIE_100", nullable=False))
    op.add_column("rankings", sa.Column("composite_raw", sa.Float(), nullable=True))
    op.create_index("ix_rankings_chart_snapshot_rank", "rankings", ["chart_type", "snapshot_at", "rank"])

    # ── published daily layer: add chart dimension, re-scope uniqueness ─────
    op.add_column("daily_index_snapshots", sa.Column("chart_type", sa.String(length=16), server_default="MOVIE_100", nullable=False))
    op.drop_constraint("uq_daily_snap_date_film", "daily_index_snapshots", type_="unique")
    op.drop_constraint("uq_daily_snap_date_rank", "daily_index_snapshots", type_="unique")
    op.drop_index("ix_daily_snap_date_rank", table_name="daily_index_snapshots")
    op.create_unique_constraint("uq_daily_snap_date_chart_film", "daily_index_snapshots", ["snapshot_date", "chart_type", "film_id"])
    op.create_unique_constraint("uq_daily_snap_date_chart_rank", "daily_index_snapshots", ["snapshot_date", "chart_type", "rank"])
    op.create_index("ix_daily_snap_date_chart_rank", "daily_index_snapshots", ["snapshot_date", "chart_type", "rank"])

    # ── published weekly layer ──────────────────────────────────────────────
    op.add_column("weekly_index_snapshots", sa.Column("chart_type", sa.String(length=16), server_default="MOVIE_100", nullable=False))
    op.drop_constraint("uq_weekly_snap_week_film", "weekly_index_snapshots", type_="unique")
    op.drop_constraint("uq_weekly_snap_week_rank", "weekly_index_snapshots", type_="unique")
    op.drop_index("ix_weekly_snap_week_rank", table_name="weekly_index_snapshots")
    op.create_unique_constraint("uq_weekly_snap_week_chart_film", "weekly_index_snapshots", ["week_start", "chart_type", "film_id"])
    op.create_unique_constraint("uq_weekly_snap_week_chart_rank", "weekly_index_snapshots", ["week_start", "chart_type", "rank"])
    op.create_index("ix_weekly_snap_week_chart_rank", "weekly_index_snapshots", ["week_start", "chart_type", "rank"])

    # ── debuts: NEW is chart-scoped ─────────────────────────────────────────
    op.add_column("index_debuts", sa.Column("chart_type", sa.String(length=16), server_default="MOVIE_100", nullable=False))
    op.drop_constraint("uq_debut_film", "index_debuts", type_="unique")
    op.create_unique_constraint("uq_debut_chart_film", "index_debuts", ["chart_type", "film_id"])


def downgrade() -> None:
    op.drop_constraint("uq_debut_chart_film", "index_debuts", type_="unique")
    op.drop_column("index_debuts", "chart_type")
    op.create_unique_constraint("uq_debut_film", "index_debuts", ["film_id"])

    op.drop_index("ix_weekly_snap_week_chart_rank", table_name="weekly_index_snapshots")
    op.drop_constraint("uq_weekly_snap_week_chart_film", "weekly_index_snapshots", type_="unique")
    op.drop_constraint("uq_weekly_snap_week_chart_rank", "weekly_index_snapshots", type_="unique")
    op.drop_column("weekly_index_snapshots", "chart_type")
    op.create_unique_constraint("uq_weekly_snap_week_film", "weekly_index_snapshots", ["week_start", "film_id"])
    op.create_unique_constraint("uq_weekly_snap_week_rank", "weekly_index_snapshots", ["week_start", "rank"])
    op.create_index("ix_weekly_snap_week_rank", "weekly_index_snapshots", ["week_start", "rank"])

    op.drop_index("ix_daily_snap_date_chart_rank", table_name="daily_index_snapshots")
    op.drop_constraint("uq_daily_snap_date_chart_film", "daily_index_snapshots", type_="unique")
    op.drop_constraint("uq_daily_snap_date_chart_rank", "daily_index_snapshots", type_="unique")
    op.drop_column("daily_index_snapshots", "chart_type")
    op.create_unique_constraint("uq_daily_snap_date_film", "daily_index_snapshots", ["snapshot_date", "film_id"])
    op.create_unique_constraint("uq_daily_snap_date_rank", "daily_index_snapshots", ["snapshot_date", "rank"])
    op.create_index("ix_daily_snap_date_rank", "daily_index_snapshots", ["snapshot_date", "rank"])

    op.drop_index("ix_rankings_chart_snapshot_rank", table_name="rankings")
    op.drop_column("rankings", "composite_raw")
    op.drop_column("rankings", "chart_type")
