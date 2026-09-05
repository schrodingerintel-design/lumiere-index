"""Add confidence-tracking columns to rankings

Revision ID: 0005_ranking_confidence
Revises: 0004_ranking_subscores
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_ranking_confidence"
down_revision = "0004_ranking_subscores"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Absolute evidence floor for editorial claims.  Nullable so historical
    # snapshot rows remain valid; backfilled by the next ranking recompute.
    op.add_column("rankings", sa.Column("sample_size", sa.Integer(), nullable=True))
    op.add_column("rankings", sa.Column("confidence", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("rankings", "confidence")
    op.drop_column("rankings", "sample_size")