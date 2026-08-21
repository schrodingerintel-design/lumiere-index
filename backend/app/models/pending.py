from datetime import datetime
from sqlalchemy import String, BigInteger, Integer, Text, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PendingMention(Base):
    """A raw mention that no existing film matched.

    The discovery pipeline consumes these: it extracts candidate titles,
    searches TMDB, and either resolves the mention to an existing film or
    creates a new film and re-ingests the mention.
    """

    __tablename__ = "pending_mentions"
    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_pending_source_ext"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    external_id: Mapped[str] = mapped_column(String(191), nullable=False)
    url: Mapped[str | None] = mapped_column(String(1000))
    author: Mapped[str | None] = mapped_column(String(191))
    country_code: Mapped[str | None] = mapped_column(String(4))
    language: Mapped[str | None] = mapped_column(String(8))
    text: Mapped[str | None] = mapped_column(Text)
    engagement: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime | None] = mapped_column(DateTime)

    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    film_id: Mapped[int | None] = mapped_column(ForeignKey("films.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
