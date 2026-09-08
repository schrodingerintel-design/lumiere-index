"""Add mentions.observations — raw underlying observation counts per record

Revision ID: 0008_mention_observations
Revises: 0007_source_health_counters
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_mention_observations"
down_revision = "0007_source_health_counters"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("mentions", sa.Column("observations", sa.BigInteger(), nullable=False, server_default="0"))
    # Backfill: per-item sources (reddit, letterboxd, news, tmdb) — one record
    # IS one observation. Aggregate sources keep 0 until their adapters are
    # updated to write real underlying counts (views/pageviews/search units).
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE mentions SET observations = engagement "
            "WHERE source_id IN (SELECT id FROM sources WHERE key IN ('reddit','letterboxd','news','tmdb'))"
        )
    )


def downgrade() -> None:
    op.drop_column("mentions", "observations")
