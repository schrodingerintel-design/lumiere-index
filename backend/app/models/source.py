from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    last_ingested_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_error: Mapped[str | None] = mapped_column(Text)
    last_error_at: Mapped[datetime | None] = mapped_column(DateTime)

    # ── Ingest health counters (reset by each scheduled run) ─────────────────
    # These make the Data/Signal Health view truthful: we record what the
    # upstream API returned (requested vs received), what the pipeline
    # processed, what it rejected (unmatched → pending queue, dedupe, errors),
    # and how many upstream calls failed with API or rate-limit errors.
    records_requested: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    api_errors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rate_limit_errors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
