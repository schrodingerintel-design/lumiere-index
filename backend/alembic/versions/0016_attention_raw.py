"""Add attention_raw audit column to rankings

Revision ID: 0016_attention_raw
Revises: 0015_chart_architecture
Create Date: 2026-09-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0016_attention_raw"
down_revision = "0015_chart_architecture"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Absolute attention intensity (decayed mentions/day, YouTube-folded) that
    # the Index Score map consumed.  Nullable so historical snapshot rows stay
    # valid; backfilled by the next ranking recompute (startup_schema also
    # backfills NULL rows to the column default on boot).
    op.add_column("rankings", sa.Column("attention_raw", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("rankings", "attention_raw")
