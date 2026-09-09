"""Published Index snapshot layer: daily/weekly snapshots + debuts

Revision ID: 0009_index_snapshots
Revises: 0008_mention_observations
Create Date: 2026-09-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_index_snapshots"
down_revision = "0008_mention_observations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_index_snapshots",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("film_id", sa.Integer(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("previous_rank", sa.Integer(), nullable=True),
        sa.Column("rank_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("score_delta", sa.Float(), nullable=True),
        sa.Column("ca_score", sa.Float(), nullable=True),
        sa.Column("momentum_score", sa.Float(), nullable=True),
        sa.Column("recency_score", sa.Float(), nullable=True),
        sa.Column("ae_score", sa.Float(), nullable=True),
        sa.Column("cp_score", sa.Float(), nullable=True),
        sa.Column("signal_volume", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.String(length=16), nullable=True),
        sa.Column("source_coverage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sentiment_positive", sa.Float(), nullable=True),
        sa.Column("sentiment_neutral", sa.Float(), nullable=True),
        sa.Column("sentiment_negative", sa.Float(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["film_id"], ["films.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("snapshot_date", "film_id", name="uq_daily_snap_date_film"),
        sa.UniqueConstraint("snapshot_date", "rank", name="uq_daily_snap_date_rank"),
    )
    op.create_index("ix_daily_snap_date_rank", "daily_index_snapshots", ["snapshot_date", "rank"])
    op.create_index("ix_daily_snap_film", "daily_index_snapshots", ["film_id"])

    op.create_table(
        "weekly_index_snapshots",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("film_id", sa.Integer(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("previous_week_rank", sa.Integer(), nullable=True),
        sa.Column("rank_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_daily_mentions", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_signal_volume", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_sentiment", sa.Float(), nullable=True),
        sa.Column("peak_daily_rank", sa.Integer(), nullable=True),
        sa.Column("source_coverage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.String(length=16), nullable=True),
        sa.Column("ca_score", sa.Float(), nullable=True),
        sa.Column("momentum_score", sa.Float(), nullable=True),
        sa.Column("recency_score", sa.Float(), nullable=True),
        sa.Column("ae_score", sa.Float(), nullable=True),
        sa.Column("cp_score", sa.Float(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["film_id"], ["films.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("week_start", "film_id", name="uq_weekly_snap_week_film"),
        sa.UniqueConstraint("week_start", "rank", name="uq_weekly_snap_week_rank"),
    )
    op.create_index("ix_weekly_snap_week_rank", "weekly_index_snapshots", ["week_start", "rank"])
    op.create_index("ix_weekly_snap_film", "weekly_index_snapshots", ["film_id"])

    op.create_table(
        "index_debuts",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("film_id", sa.Integer(), nullable=False),
        sa.Column("debut_date", sa.Date(), nullable=False),
        sa.Column("debut_rank", sa.Integer(), nullable=False),
        sa.Column("debut_score", sa.Float(), nullable=False),
        sa.Column("confidence", sa.String(length=16), nullable=True),
        sa.Column("signal_volume", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["film_id"], ["films.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("film_id", name="uq_debut_film"),
    )
    op.create_index("ix_debut_date", "index_debuts", ["debut_date"])


def downgrade() -> None:
    op.drop_index("ix_debut_date", table_name="index_debuts")
    op.drop_table("index_debuts")
    op.drop_index("ix_weekly_snap_film", table_name="weekly_index_snapshots")
    op.drop_index("ix_weekly_snap_week_rank", table_name="weekly_index_snapshots")
    op.drop_table("weekly_index_snapshots")
    op.drop_index("ix_daily_snap_film", table_name="daily_index_snapshots")
    op.drop_index("ix_daily_snap_date_rank", table_name="daily_index_snapshots")
    op.drop_table("daily_index_snapshots")
