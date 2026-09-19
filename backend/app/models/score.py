from datetime import date, datetime
from sqlalchemy import Integer, BigInteger, Float, Date, DateTime, ForeignKey, Index, String
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
    __table_args__ = (
        Index("ix_rankings_snapshot_rank", "snapshot_at", "rank"),
        Index("ix_rankings_chart_snapshot_rank", "chart_type", "snapshot_at", "rank"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    snapshot_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # The official chart this row belongs to — rank is ALWAYS contextual to a
    # chart (MOVIE_100, TV_100; ACTOR_100/DIRECTOR_100 arrive in Phase 3).
    # Legacy rows predate charts and are treated as MOVIE_100.
    chart_type: Mapped[str] = mapped_column(String(16), nullable=False, server_default="MOVIE_100")
    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    # Raw cultural momentum before the 0–100 Index Score mapping — internal
    # only (admin score inspector); never exposed publicly.
    composite_raw: Mapped[float | None] = mapped_column(Float, nullable=True)
    prev_rank: Mapped[int | None] = mapped_column(Integer)
    movement: Mapped[int] = mapped_column(Integer, default=0)
    peak_rank: Mapped[int | None] = mapped_column(Integer)
    weeks_on_chart: Mapped[int] = mapped_column(Integer, default=0)
    # Per-component sub-scores (nullable for backward-compat with old snapshots)
    ca_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    momentum_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    recency_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ae_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cp_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Absolute evidence floor for editorial claims, computed per ranking cycle:
    # raw mention/signal count feeding the scores (pre-normalization) and the
    # confidence tier derived from it ("insufficient"|"low"|"moderate"|"high").
    sample_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(16), nullable=True)


class CountryScore(Base):
    __tablename__ = "country_scores"

    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), primary_key=True)
    country_code: Mapped[str] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    mentions_count: Mapped[int] = mapped_column(Integer, default=0)
