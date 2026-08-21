"""phase 1: continuous discovery

- films.tmdb_id (dedupe upserts by TMDB id)
- sources health tracking columns
- pending_mentions table (unmatched-mention candidate queue)

Revision ID: 0002_phase1
Revises: 0001_initial
Create Date: 2026-08-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_phase1"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("films", sa.Column("tmdb_id", sa.Integer, nullable=True))
    op.create_index("ix_films_tmdb_id", "films", ["tmdb_id"], unique=True)

    op.add_column("sources", sa.Column("enabled", sa.Boolean, nullable=False, server_default="1"))
    op.add_column("sources", sa.Column("last_ingested_at", sa.DateTime, nullable=True))
    op.add_column("sources", sa.Column("last_error", sa.Text, nullable=True))
    op.add_column("sources", sa.Column("last_error_at", sa.DateTime, nullable=True))

    op.create_table(
        "pending_mentions",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.Integer, sa.ForeignKey("sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_id", sa.String(191), nullable=False),
        sa.Column("url", sa.String(1000)),
        sa.Column("author", sa.String(191)),
        sa.Column("country_code", sa.String(4)),
        sa.Column("language", sa.String(8)),
        sa.Column("text", sa.Text),
        sa.Column("engagement", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("film_id", sa.Integer, sa.ForeignKey("films.id", ondelete="SET NULL")),
        sa.Column("resolved_at", sa.DateTime),
        sa.UniqueConstraint("source_id", "external_id", name="uq_pending_source_ext"),
    )


def downgrade() -> None:
    op.drop_table("pending_mentions")
    op.drop_column("sources", "last_error_at")
    op.drop_column("sources", "last_error")
    op.drop_column("sources", "last_ingested_at")
    op.drop_column("sources", "enabled")
    op.drop_index("ix_films_tmdb_id", table_name="films")
    op.drop_column("films", "tmdb_id")
