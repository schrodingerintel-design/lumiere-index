"""Official published Index snapshots — the historical record layer.

The `rankings` table remains the continuous computation layer (recomputed on
every refresh cycle).  These tables are the *published* record:

  daily_index_snapshots   — the official Daily Index (once per day, Top 100)
  weekly_index_snapshots  — the official Weekly Index (once per week, Top 100)
  index_debuts            — first-ever Index appearance per film (New Entries)

Published rows are immutable: a snapshot is written once per publication day
(weekly: per ISO week) and never updated afterwards.  The unique constraints
enforce idempotent publication — re-running a publish job on the same date is
a no-op, never a duplicate.
"""
from datetime import date, datetime
from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DailyIndexSnapshot(Base):
    """One row per film per published Daily Index.

    `snapshot_date` is the publication day (UTC).  Movement fields compare
    against the previous published Daily Index — not against the continuous
    15-minute `rankings` computation.
    """

    __tablename__ = "daily_index_snapshots"
    __table_args__ = (
        UniqueConstraint("snapshot_date", "film_id", name="uq_daily_snap_date_film"),
        UniqueConstraint("snapshot_date", "rank", name="uq_daily_snap_date_rank"),
        Index("ix_daily_snap_date_rank", "snapshot_date", "rank"),
        Index("ix_daily_snap_film", "film_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    previous_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rank_delta: Mapped[int] = mapped_column(Integer, default=0)
    score_delta: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Score components at publication time (normalised 0-1 values)
    ca_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    momentum_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    recency_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ae_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cp_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Evidence: raw signal volume feeding the score + derived tier
    signal_volume: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[str | None] = mapped_column(String(16), nullable=True)
    source_coverage: Mapped[int] = mapped_column(Integer, default=0)
    # Sentiment aggregate at publication time
    sentiment_positive: Mapped[float | None] = mapped_column(Float, nullable=True)
    sentiment_neutral: Mapped[float | None] = mapped_column(Float, nullable=True)
    sentiment_negative: Mapped[float | None] = mapped_column(Float, nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class WeeklyIndexSnapshot(Base):
    """One row per film per published Weekly Index.

    `week_start`/`week_end` bound the measurement window (ISO week, Monday–
    Sunday, UTC).  The weekly score aggregates the daily measurements inside
    that window; `previous_week_rank` compares against the prior published
    week.  Rows are immutable once written.
    """

    __tablename__ = "weekly_index_snapshots"
    __table_args__ = (
        UniqueConstraint("week_start", "film_id", name="uq_weekly_snap_week_film"),
        UniqueConstraint("week_start", "rank", name="uq_weekly_snap_week_rank"),
        Index("ix_weekly_snap_week_rank", "week_start", "rank"),
        Index("ix_weekly_snap_film", "film_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    previous_week_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rank_delta: Mapped[int] = mapped_column(Integer, default=0)
    # Aggregated signal measurements over the week window
    avg_daily_mentions: Mapped[float] = mapped_column(Float, default=0)
    total_signal_volume: Mapped[int] = mapped_column(Integer, default=0)
    avg_sentiment: Mapped[float | None] = mapped_column(Float, nullable=True)
    peak_daily_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_coverage: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Score components averaged over the week window
    ca_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    momentum_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    recency_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ae_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cp_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class IndexDebut(Base):
    """First-ever appearance of a film on a published Daily Index.

    One row per film, ever — the unique constraint on film_id makes "debuted
    once, never again" a database invariant, not application discipline.
    """

    __tablename__ = "index_debuts"
    __table_args__ = (
        UniqueConstraint("film_id", name="uq_debut_film"),
        Index("ix_debut_date", "debut_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    debut_date: Mapped[date] = mapped_column(Date, nullable=False)
    debut_rank: Mapped[int] = mapped_column(Integer, nullable=False)
    debut_score: Mapped[float] = mapped_column(Float, nullable=False)
    # Evidence state at debut
    confidence: Mapped[str | None] = mapped_column(String(16), nullable=True)
    signal_volume: Mapped[int] = mapped_column(Integer, default=0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
