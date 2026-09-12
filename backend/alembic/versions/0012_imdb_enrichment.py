"""Add imdb_enrichments, imdb_vote_snapshots tables and imdb_id column on films

Revision ID: 0012_imdb_enrichment
Revises: 0011_youtube_signals
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_imdb_enrichment"
down_revision = "0011_youtube_signals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add stored imdb_id to films for direct tconst matching
    op.add_column("films", sa.Column("imdb_id", sa.String(length=32), nullable=True))
    op.create_index("ix_films_imdb_id", "films", ["imdb_id"])

    # 2. IMDb enrichments table
    op.create_table(
        "imdb_enrichments",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("film_id", sa.Integer(), sa.ForeignKey("films.id", ondelete="CASCADE"), nullable=True),
        sa.Column("tmdb_movie_id", sa.Integer(), nullable=True),
        sa.Column("imdb_id", sa.String(length=32), nullable=False),
        sa.Column("average_rating", sa.Float(), nullable=True),
        sa.Column("num_votes", sa.Integer(), nullable=True),
        sa.Column("primary_title", sa.String(length=255), nullable=True),
        sa.Column("original_title", sa.String(length=255), nullable=True),
        sa.Column("start_year", sa.Integer(), nullable=True),
        sa.Column("runtime_minutes", sa.Integer(), nullable=True),
        sa.Column("genres", sa.String(length=255), nullable=True),
        sa.Column("imported_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("dataset_updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("imdb_id", name="uq_imdb_enrichments_imdb_id"),
        sa.UniqueConstraint("film_id", name="uq_imdb_enrichments_film_id"),
    )
    op.create_index("ix_imdb_enrichments_film_id", "imdb_enrichments", ["film_id"])
    op.create_index("ix_imdb_enrichments_imdb_id", "imdb_enrichments", ["imdb_id"])
    op.create_index("ix_imdb_enrichments_tmdb_movie_id", "imdb_enrichments", ["tmdb_movie_id"])

    # 3. IMDb vote snapshots table (Phase 3 Experimental Momentum)
    op.create_table(
        "imdb_vote_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("film_id", sa.Integer(), sa.ForeignKey("films.id", ondelete="CASCADE"), nullable=False),
        sa.Column("imdb_id", sa.String(length=32), nullable=False),
        sa.Column("num_votes", sa.Integer(), nullable=False),
        sa.Column("average_rating", sa.Float(), nullable=True),
        sa.Column("vote_growth", sa.Integer(), server_default="0", nullable=False),
        sa.Column("vote_velocity", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("elapsed_days", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("snapshot_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_imdb_vote_snapshots_film_id", "imdb_vote_snapshots", ["film_id"])
    op.create_index("ix_imdb_vote_snapshots_imdb_id", "imdb_vote_snapshots", ["imdb_id"])
    op.create_index("ix_imdb_vote_snapshots_snapshot_at", "imdb_vote_snapshots", ["snapshot_at"])
    op.create_index("ix_imdb_vote_snapshots_film_date", "imdb_vote_snapshots", ["film_id", "snapshot_at"])


def downgrade() -> None:
    op.drop_index("ix_imdb_vote_snapshots_film_date", table_name="imdb_vote_snapshots")
    op.drop_index("ix_imdb_vote_snapshots_snapshot_at", table_name="imdb_vote_snapshots")
    op.drop_index("ix_imdb_vote_snapshots_imdb_id", table_name="imdb_vote_snapshots")
    op.drop_index("ix_imdb_vote_snapshots_film_id", table_name="imdb_vote_snapshots")
    op.drop_table("imdb_vote_snapshots")

    op.drop_index("ix_imdb_enrichments_tmdb_movie_id", table_name="imdb_enrichments")
    op.drop_index("ix_imdb_enrichments_imdb_id", table_name="imdb_enrichments")
    op.drop_index("ix_imdb_enrichments_film_id", table_name="imdb_enrichments")
    op.drop_table("imdb_enrichments")

    op.drop_index("ix_films_imdb_id", table_name="films")
    op.drop_column("films", "imdb_id")
