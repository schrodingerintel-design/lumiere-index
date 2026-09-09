"""Content model: MOVIE / TV_SHOW + original_title + first_air_date

Revision ID: 0010_content_types
Revises: 0009_index_snapshots
Create Date: 2026-09-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_content_types"
down_revision = "0009_index_snapshots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("films", sa.Column("original_title", sa.String(length=255), nullable=True))
    op.add_column(
        "films",
        sa.Column("content_type", sa.String(length=16), nullable=False, server_default="MOVIE"),
    )
    op.add_column("films", sa.Column("first_air_date", sa.Date(), nullable=True))

    # All existing rows are movies.
    op.create_index("ix_films_content_type", "films", ["content_type"])

    # TMDB ids for movies and TV are separate id spaces; the old global unique
    # index on tmdb_id must become a per-content-type unique constraint.
    op.drop_index("ix_films_tmdb_id", table_name="films")
    op.create_unique_constraint("uq_films_content_type_tmdb", "films", ["content_type", "tmdb_id"])
    op.create_index("ix_films_tmdb_id", "films", ["tmdb_id"])

    # Backfill: TV first_air_date was previously crammed into release_date —
    # not applicable to rows created before TV support, so nothing to move.


def downgrade() -> None:
    op.drop_index("ix_films_tmdb_id", table_name="films")
    op.drop_constraint("uq_films_content_type_tmdb", "films", type_="unique")
    op.create_index("ix_films_tmdb_id", "films", ["tmdb_id"], unique=True)
    op.drop_index("ix_films_content_type", table_name="films")
    op.drop_column("films", "first_air_date")
    op.drop_column("films", "content_type")
    op.drop_column("films", "original_title")
