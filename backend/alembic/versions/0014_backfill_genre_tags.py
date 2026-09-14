"""Backfill films.genre_tag from the known seed catalog

Revision ID: 0014_backfill_genre_tags
Revises: 0013_raw_metric_snapshots
Create Date: 2026-09-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0014_backfill_genre_tags"
down_revision = "0013_raw_metric_snapshots"
branch_labels = None
depends_on = None

# Title → canonical genre tag from the seed catalog.
TITLE_GENRE_MAP = {
    "Mickey 17": "Sci-Fi",
    "Superman": "Action",
    "Avatar Fire and Ash": "Sci-Fi",
    "F1": "Action",
    "Sinners": "Horror",
    "Jurassic World Rebirth": "Action",
    "28 Years Later": "Horror",
    "The Fantastic Four First Steps": "Action",
    "Mission Impossible The Final Reckoning": "Action",
    "Michael": "Drama",
    "Bugonia": "Indie",
    "Klara and the Sun": "Sci-Fi",
    "Novocaine": "Action",
    "The Accountant 2": "Action",
    "Until Dawn": "Horror",
    "Black Bag": "Drama",
    "Death of a Unicorn": "Indie",
    "A Minecraft Movie": "Action",
    "Captain America Brave New World": "Action",
    "Snow White": "Drama",
    "Thunderbolts": "Action",
    "The Bride": "Drama",
    "Warfare": "Action",
    "Elio": "Sci-Fi",
    "Lilo and Stitch": "Drama",
    "How to Train Your Dragon": "Action",
    "Karate Kid Legends": "Action",
    "Final Destination Bloodlines": "Horror",
    "Dune Part Two": "Sci-Fi",
    "The Substance": "Horror",
    "Anora": "Indie",
    "Challengers": "Drama",
    "Alien Romulus": "Sci-Fi",
    "Twisters": "Action",
    "Deadpool and Wolverine": "Action",
    "Inside Out 2": "Drama",
    "Wicked": "Drama",
    "Gladiator II": "Action",
    "Conclave": "Drama",
    "The Brutalist": "Indie",
    "A Complete Unknown": "Drama",
    "Nosferatu": "Horror",
    "Heretic": "Horror",
    "We Live in Time": "Drama",
    "Smile 2": "Horror",
    "Furiosa": "Action",
    "Kingdom of the Planet of the Apes": "Action",
    "Longlegs": "Horror",
    "Blink Twice": "Drama",
    "Speak No Evil": "Horror",
    "The Apprentice": "Drama",
    "Memoir of a Snail": "Indie",
    "His Three Daughters": "Indie",
    "Nickel Boys": "Indie",
    "September 5": "Drama",
    "I'm Still Here": "Drama",
    "Blitz": "Drama",
    "The Seed of the Sacred Fig": "Indie",
    "Hard Truths": "Drama",
    "Flow": "Indie",
    "Dahomey": "Indie",
    "All We Imagine as Light": "Indie",
    "Emilia Perez": "Indie",
    "The Room Next Door": "Drama",
    "Perfect Days": "Indie",
    "Past Lives": "Indie",
    "Monster": "Indie",
    "The Zone of Interest": "Drama",
    "Poor Things": "Indie",
    "Killers of the Flower Moon": "Drama",
    "Oppenheimer": "Drama",
    "Barbie": "Drama",
    "Spider-Man Across the Spider-Verse": "Sci-Fi",
    "Godzilla Minus One": "Sci-Fi",
    "The Holdovers": "Drama",
    "Maestro": "Drama",
    "May December": "Drama",
    "American Fiction": "Drama",
    "Saltburn": "Indie",
    "Priscilla": "Drama",
    "El Conde": "Indie",
}


def upgrade() -> None:
    conn = op.get_bind()
    updated = 0
    for title, tag in TITLE_GENRE_MAP.items():
        result = conn.execute(
            sa.text(
                "UPDATE films SET genre_tag = :tag "
                "WHERE title = :title AND (genre_tag IS NULL OR genre_tag = '')"
            ),
            {"tag": tag, "title": title},
        )
        updated += result.rowcount
    print(f"Backfill: updated genre_tag on {updated} films")


def downgrade() -> None:
    conn = op.get_bind()
    for title in TITLE_GENRE_MAP:
        conn.execute(
            sa.text(
                "UPDATE films SET genre_tag = NULL WHERE title = :title"
            ),
            {"title": title},
        )
