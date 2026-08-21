from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TrendingTopic(Base):
    __tablename__ = "trending_topics"
    __table_args__ = (Index("ix_trending_snapshot", "snapshot_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    topic: Mapped[str] = mapped_column(String(191), nullable=False)
    slug: Mapped[str] = mapped_column(String(191), nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0)
    delta_pct: Mapped[float] = mapped_column(Float, default=0)
    snapshot_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
