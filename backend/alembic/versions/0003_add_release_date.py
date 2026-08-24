"""add release_date to films

Revision ID: 0003_add_release_date
Revises: 0002_phase1
Create Date: 2026-08-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_add_release_date"
down_revision = "0002_phase1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("films", sa.Column("release_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("films", "release_date")
