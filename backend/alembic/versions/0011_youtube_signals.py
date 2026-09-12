"""Add youtube_signals table for YouTube Data API v3 trailer metrics

Revision ID: 0011_youtube_signals
Revises: 0010_content_types
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_youtube_signals"
down_revision = "0010_content_types"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "youtube_signals",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("film_id", sa.Integer(), sa.ForeignKey("films.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_id", sa.String(length=32), nullable=False),
        sa.Column("video_title", sa.String(length=255), nullable=True),
        sa.Column("channel_title", sa.String(length=255), nullable=True),
        sa.Column("view_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comment_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("view_velocity", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("is_official", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("raw_stats_json", sa.Text(), nullable=True),
        sa.UniqueConstraint("film_id", "video_id", name="uq_youtube_signals_film_video"),
    )
    op.create_index("ix_youtube_signals_film_id", "youtube_signals", ["film_id"])
    op.create_index("ix_youtube_signals_video_id", "youtube_signals", ["video_id"])
    op.create_index("ix_youtube_signals_film_fetched", "youtube_signals", ["film_id", "fetched_at"])


def downgrade() -> None:
    op.drop_index("ix_youtube_signals_film_fetched", table_name="youtube_signals")
    op.drop_index("ix_youtube_signals_video_id", table_name="youtube_signals")
    op.drop_index("ix_youtube_signals_film_id", table_name="youtube_signals")
    op.drop_table("youtube_signals")
