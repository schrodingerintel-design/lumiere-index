"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "films",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("slug", sa.String(160), nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("director", sa.String(255)),
        sa.Column("year", sa.Integer),
        sa.Column("runtime_min", sa.Integer),
        sa.Column("country_origin", sa.String(4)),
        sa.Column("poster_url", sa.String(500)),
        sa.Column("backdrop_url", sa.String(500)),
        sa.Column("synopsis", sa.Text),
        sa.Column("gradient_from", sa.String(20)),
        sa.Column("gradient_to", sa.String(20)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "film_aliases",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("film_id", sa.Integer, sa.ForeignKey("films.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alias", sa.String(255), nullable=False),
        sa.Index("ix_film_aliases_alias", "alias"),
    )
    op.create_table(
        "sources",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("weight", sa.Float, nullable=False, server_default="1.0"),
    )
    op.create_table(
        "mentions",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("film_id", sa.Integer, sa.ForeignKey("films.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_id", sa.Integer, sa.ForeignKey("sources.id"), nullable=False),
        sa.Column("external_id", sa.String(191), nullable=False),
        sa.Column("url", sa.String(1000)),
        sa.Column("author", sa.String(191)),
        sa.Column("country_code", sa.String(4)),
        sa.Column("language", sa.String(8)),
        sa.Column("text", sa.Text),
        sa.Column("sentiment_score", sa.Float),
        sa.Column("sentiment_label", sa.String(10)),
        sa.Column("engagement", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime),
        sa.Column("ingested_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("source_id", "external_id", name="uq_mentions_source_ext"),
        sa.Index("ix_mentions_film_created", "film_id", "created_at"),
    )
    op.create_table(
        "daily_scores",
        sa.Column("film_id", sa.Integer, sa.ForeignKey("films.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("day", sa.Date, primary_key=True),
        sa.Column("mentions_count", sa.Integer, server_default="0"),
        sa.Column("weighted_score", sa.Float, server_default="0"),
        sa.Column("sentiment_avg", sa.Float, server_default="0"),
        sa.Column("pos_pct", sa.Float, server_default="0"),
        sa.Column("neu_pct", sa.Float, server_default="0"),
        sa.Column("neg_pct", sa.Float, server_default="0"),
    )
    op.create_table(
        "rankings",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("snapshot_at", sa.DateTime, nullable=False),
        sa.Column("film_id", sa.Integer, sa.ForeignKey("films.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rank", sa.Integer, nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("prev_rank", sa.Integer),
        sa.Column("movement", sa.Integer, server_default="0"),
        sa.Column("peak_rank", sa.Integer),
        sa.Column("weeks_on_chart", sa.Integer, server_default="0"),
        sa.Index("ix_rankings_snapshot_rank", "snapshot_at", "rank"),
    )
    op.create_table(
        "country_scores",
        sa.Column("film_id", sa.Integer, sa.ForeignKey("films.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("country_code", sa.String(4), primary_key=True),
        sa.Column("day", sa.Date, primary_key=True),
        sa.Column("score", sa.Float, server_default="0"),
        sa.Column("mentions_count", sa.Integer, server_default="0"),
    )
    op.create_table(
        "trending_topics",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("topic", sa.String(191), nullable=False),
        sa.Column("slug", sa.String(191), nullable=False),
        sa.Column("score", sa.Float, server_default="0"),
        sa.Column("delta_pct", sa.Float, server_default="0"),
        sa.Column("snapshot_at", sa.DateTime, nullable=False),
        sa.Index("ix_trending_snapshot", "snapshot_at"),
    )
    op.create_table(
        "newsletter_subs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("confirmed_at", sa.DateTime),
    )


def downgrade() -> None:
    for t in [
        "newsletter_subs", "trending_topics", "country_scores", "rankings",
        "daily_scores", "mentions", "sources", "film_aliases", "films",
    ]:
        op.drop_table(t)
