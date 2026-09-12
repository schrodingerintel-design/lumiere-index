"""Add metric_snapshots table for aggregate public attention metrics

Revision ID: 0013_raw_metric_snapshots
Revises: 0012_imdb_enrichment
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = "0013_raw_metric_snapshots"
down_revision = "0012_imdb_enrichment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "metric_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("sources.id"), nullable=False),
        sa.Column("external_id", sa.String(length=191), nullable=False),
        sa.Column("film_id", sa.Integer(), sa.ForeignKey("films.id", ondelete="CASCADE"), nullable=True),
        sa.Column("metric_type", sa.String(length=64), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("observed_at", sa.DateTime(), nullable=False),
        sa.Column("country", sa.String(length=4), nullable=True),
        sa.Column("observations", sa.BigInteger(), nullable=True),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("attribution", sa.String(length=255), nullable=True),
        sa.Column("raw_payload_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source_id", "external_id", "metric_type", name="uq_metric_snap_src_ext_type"),
    )
    op.create_index("ix_metric_snap_film_metric", "metric_snapshots", ["film_id", "metric_type", "observed_at"])
    op.create_index("ix_metric_snap_source_observed", "metric_snapshots", ["source_id", "observed_at"])
    op.create_index("ix_metric_snap_external_id", "metric_snapshots", ["external_id"])


def downgrade() -> None:
    op.drop_index("ix_metric_snap_external_id", table_name="metric_snapshots")
    op.drop_index("ix_metric_snap_source_observed", table_name="metric_snapshots")
    op.drop_index("ix_metric_snap_film_metric", table_name="metric_snapshots")
    op.drop_table("metric_snapshots")
