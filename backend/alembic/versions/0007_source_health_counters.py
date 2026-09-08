"""Add per-run ingest health counters to sources

Revision ID: 0007_source_health_counters
Revises: 0006_film_genre_tag
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_source_health_counters"
down_revision = "0006_film_genre_tag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sources", sa.Column("records_requested", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("sources", sa.Column("records_received", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("sources", sa.Column("records_processed", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("sources", sa.Column("records_rejected", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("sources", sa.Column("api_errors", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("sources", sa.Column("rate_limit_errors", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("sources", "rate_limit_errors")
    op.drop_column("sources", "api_errors")
    op.drop_column("sources", "records_rejected")
    op.drop_column("sources", "records_processed")
    op.drop_column("sources", "records_received")
    op.drop_column("sources", "records_requested")