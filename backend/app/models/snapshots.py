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

# Official chart identifiers.  Rank is ALWAYS contextual to a chart; the
# string values double as the persisted chart_id across every layer.
MOVIE_100 = "MOVIE_100"
TV_100 = "TV_100"
OFFICIAL_CHART_TYPES = (MOVIE_100, TV_100)
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
        UniqueConstraint("snapshot_date", "chart_type", "film_id", name="uq_daily_snap_date_chart_film"),
        UniqueConstraint("snapshot_date", "chart_type", "rank", name="uq_daily_snap_date_chart_rank"),
        Index("ix_daily_snap_date_chart_rank", "snapshot_date", "chart_type", "rank"),
        Index("ix_daily_snap_film", "film_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    # The official chart this row belongs to — historical rank is ALWAYS tied
    # to a chart_id.  Legacy rows predate charts and are treated as MOVIE_100.
    chart_type: Mapped[str] = mapped_column(String(16), nullable=False, server_default="MOVIE_100")
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
        UniqueConstraint("week_start", "chart_type", "film_id", name="uq_weekly_snap_week_chart_film"),
        UniqueConstraint("week_start", "chart_type", "rank", name="uq_weekly_snap_week_chart_rank"),
        Index("ix_weekly_snap_week_chart_rank", "week_start", "chart_type", "rank"),
        Index("ix_weekly_snap_film", "film_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    # Chart this weekly chart belongs to — weekly rank is chart-scoped too.
    chart_type: Mapped[str] = mapped_column(String(16), nullable=False, server_default="MOVIE_100")
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
    """First-ever appearance of a title on a published Daily chart.

    One row per (chart, title), ever — the unique constraint makes "debuted
    once per chart, never again" a database invariant, not application
    discipline.  NEW is always chart-scoped.
    """

    __tablename__ = "index_debuts"
    __table_args__ = (
        UniqueConstraint("chart_type", "film_id", name="uq_debut_chart_film"),
        Index("ix_debut_date", "debut_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # Chart-scoped debut — a title can debut on Movie 100 and separately on
    # TV 100 only if it were both, which cannot happen; the chart dimension
    # still keeps the record unambiguous for the ACTOR/DIRECTOR charts later.
    chart_type: Mapped[str] = mapped_column(String(16), nullable=False, server_default="MOVIE_100")
    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    debut_date: Mapped[date] = mapped_column(Date, nullable=False)
    debut_rank: Mapped[int] = mapped_column(Integer, nullable=False)
    debut_score: Mapped[float] = mapped_column(Float, nullable=False)
    # Evidence state at debut
    confidence: Mapped[str | None] = mapped_column(String(16), nullable=True)
    signal_volume: Mapped[int] = mapped_column(Integer, default=0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
