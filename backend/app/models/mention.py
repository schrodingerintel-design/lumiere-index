from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Float, Text, DateTime, ForeignKey, func, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Mention(Base):
    __tablename__ = "mentions"
    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_mentions_source_ext"),
        Index("ix_mentions_film_created", "film_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), nullable=False)
    external_id: Mapped[str] = mapped_column(String(191), nullable=False)
    url: Mapped[str | None] = mapped_column(String(1000))
    author: Mapped[str | None] = mapped_column(String(191))
    country_code: Mapped[str | None] = mapped_column(String(4))
    language: Mapped[str | None] = mapped_column(String(8))
    text: Mapped[str | None] = mapped_column(Text)
    sentiment_score: Mapped[float | None] = mapped_column(Float)
    sentiment_label: Mapped[str | None] = mapped_column(String(10))
    engagement: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime | None] = mapped_column(DateTime)
    ingested_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
