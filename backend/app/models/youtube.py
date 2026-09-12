from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    BigInteger,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class YouTubeSignal(Base):
    """Stores processed YouTube trailer signals per film.

    Captures official trailer statistics (views, likes, comments, velocity)
    extracted securely on the backend from the YouTube Data API v3.
    """
    __tablename__ = "youtube_signals"
    __table_args__ = (
        UniqueConstraint("film_id", "video_id", name="uq_youtube_signals_film_video"),
        Index("ix_youtube_signals_film_fetched", "film_id", "fetched_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    film_id: Mapped[int] = mapped_column(
        ForeignKey("films.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    video_title: Mapped[str | None] = mapped_column(String(255))
    channel_title: Mapped[str | None] = mapped_column(String(255))
    view_count: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    # Computed views per day since published_at: view_count / max(days_since_publish, 0.5)
    view_velocity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Matcher confidence ∈ [0.0, 1.0]
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_official: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Compact JSON storage for audit/diagnostics
    raw_stats_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    film: Mapped["Film"] = relationship("Film", back_populates="youtube_signals")
