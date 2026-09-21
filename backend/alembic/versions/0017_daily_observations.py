"""Add daily_scores.observations_sum — raw observation volume per day

Revision ID: 0017_daily_observations
Revises: 0016_attention_raw
Create Date: 2026-09-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0017_daily_observations"
down_revision = "0016_attention_raw"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SUM of Mention.observations per (film, day). Nullable: rows written
    # before this column carry NULL and consumers fall back to mentions_count
    # (row count) for them. rollup_daily rebuilds the trailing 30 days on its
    # next hourly run, which backfills real values for the live window.
    op.add_column(
        "daily_scores",
        sa.Column("observations_sum", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("daily_scores", "observations_sum")
