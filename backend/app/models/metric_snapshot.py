from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class MetricSnapshot(Base):
    """Normalized aggregate metric observation (e.g. Wikipedia pageviews, YouTube velocity).

    Separated from textual Mention records to prevent aggregate metrics
    from corrupting sentiment analysis or generating artificial mentions.
    """
    __tablename__ = "metric_snapshots"
    __table_args__ = (
        UniqueConstraint("source_id", "external_id", "metric_type", name="uq_metric_snap_src_ext_type"),
        Index("ix_metric_snap_film_metric", "film_id", "metric_type", "observed_at"),
        Index("ix_metric_snap_source_observed", "source_id", "observed_at"),
        Index("ix_metric_snap_external_id", "external_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), nullable=False)
    external_id: Mapped[str] = mapped_column(String(191), nullable=False)
    film_id: Mapped[int | None] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=True)
    metric_type: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    country: Mapped[str | None] = mapped_column(String(4), nullable=True)
    observations: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    attribution: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_payload_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
