from datetime import date, datetime
from sqlalchemy import Integer, BigInteger, Float, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DailyScore(Base):
    __tablename__ = "daily_scores"

    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    mentions_count: Mapped[int] = mapped_column(Integer, default=0)
    weighted_score: Mapped[float] = mapped_column(Float, default=0)
    sentiment_avg: Mapped[float] = mapped_column(Float, default=0)
    pos_pct: Mapped[float] = mapped_column(Float, default=0)
    neu_pct: Mapped[float] = mapped_column(Float, default=0)
    neg_pct: Mapped[float] = mapped_column(Float, default=0)


class Ranking(Base):
    __tablename__ = "rankings"
    __table_args__ = (Index("ix_rankings_snapshot_rank", "snapshot_at", "rank"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    snapshot_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    prev_rank: Mapped[int | None] = mapped_column(Integer)
    movement: Mapped[int] = mapped_column(Integer, default=0)
    peak_rank: Mapped[int | None] = mapped_column(Integer)
    weeks_on_chart: Mapped[int] = mapped_column(Integer, default=0)


class CountryScore(Base):
    __tablename__ = "country_scores"

    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), primary_key=True)
    country_code: Mapped[str] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    mentions_count: Mapped[int] = mapped_column(Integer, default=0)
