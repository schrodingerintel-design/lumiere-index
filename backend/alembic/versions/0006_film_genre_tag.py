"""Add films.genre_tag — canonical genre used by frontend collections

Revision ID: 0006_film_genre_tag
Revises: 0005_ranking_confidence
Create Date: 2026-09-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_film_genre_tag"
down_revision = "0005_ranking_confidence"
branch_labels = None
depends_on = None

# Backfill for the seeded catalog, whose synopsis embeds the genre:
# "<Title>, directed by <Director> (<Year>). A premier <Genre> entry on Lumière."
# Live TMDB-synced films keep NULL until the next catalog sync tags them from
# TMDB genre ids.
KNOWN_TAGS = [
    "Sci-Fi",
    "Action",
    "Horror",
    "Drama",
    "Indie",
    "Animation",
    "Romance",
    "Comedy",
    "Thriller",
]


def upgrade() -> None:
    op.add_column("films", sa.Column("genre_tag", sa.String(length=40), nullable=True))

    conn = op.get_bind()
    films = conn.execute(sa.text("SELECT id, synopsis FROM films")).fetchall()
    for film_id, synopsis in films:
        if not synopsis:
            continue
        # Extract "A premier <Genre> entry on Lumière." from the seed synopsis.
        marker = "A premier "
        idx = synopsis.find(marker)
        if idx == -1:
            continue
        tail = synopsis[idx + len(marker):]
        for tag in KNOWN_TAGS:
            if tail.startswith(tag):
                conn.execute(
                    sa.text("UPDATE films SET genre_tag = :tag WHERE id = :id"),
                    {"tag": tag, "id": film_id},
                )
                break


def downgrade() -> None:
    op.drop_column("films", "genre_tag")
