"""Add per-component sub-score columns to rankings

Revision ID: 0004_ranking_subscores
Revises: 0003_add_release_date
Create Date: 2026-09-02
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_ranking_subscores"
down_revision = "0003_add_release_date"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Five nullable sub-score columns so historical snapshot rows remain valid.
    op.add_column("rankings", sa.Column("ca_score", sa.Float(), nullable=True))
    op.add_column("rankings", sa.Column("momentum_score", sa.Float(), nullable=True))
    op.add_column("rankings", sa.Column("recency_score", sa.Float(), nullable=True))
    op.add_column("rankings", sa.Column("ae_score", sa.Float(), nullable=True))
    op.add_column("rankings", sa.Column("cp_score", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("rankings", "cp_score")
    op.drop_column("rankings", "ae_score")
    op.drop_column("rankings", "recency_score")
    op.drop_column("rankings", "momentum_score")
    op.drop_column("rankings", "ca_score")
