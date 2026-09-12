from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    BigInteger,
    Float,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class IMDbEnrichment(Base):
    """Stores IMDb metadata & rating enrichment per film.

    Ingested strictly from official IMDb dataset downloads (title.basics.tsv.gz and
    title.ratings.tsv.gz). Provides metadata enrichment (ratings, votes, titles, runtime)
    without affecting the core ranking formulas.
    """
    __tablename__ = "imdb_enrichments"
    __table_args__ = (
        UniqueConstraint("imdb_id", name="uq_imdb_enrichments_imdb_id"),
        UniqueConstraint("film_id", name="uq_imdb_enrichments_film_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    film_id: Mapped[int | None] = mapped_column(
        ForeignKey("films.id", ondelete="CASCADE"), nullable=True, index=True
    )
    tmdb_movie_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    imdb_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # tconst e.g. tt1375666
    average_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    num_votes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    primary_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    runtime_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genres: Mapped[str | None] = mapped_column(String(255), nullable=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    dataset_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    film: Mapped["Film"] = relationship("Film", back_populates="imdb_enrichment")


class IMDbVoteSnapshot(Base):
    """Periodic snapshots of IMDb vote counts for experimental momentum computation.

    Phase 3: Gated behind ENABLE_IMDB_MOMENTUM=false.
    Treated as metric snapshots, not social mentions.
    """
    __tablename__ = "imdb_vote_snapshots"
    __table_args__ = (
        Index("ix_imdb_vote_snapshots_film_date", "film_id", "snapshot_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    film_id: Mapped[int] = mapped_column(
        ForeignKey("films.id", ondelete="CASCADE"), nullable=False, index=True
    )
    imdb_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    num_votes: Mapped[int] = mapped_column(Integer, nullable=False)
    average_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    vote_growth: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    vote_velocity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # votes/day
    elapsed_days: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    snapshot_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False, index=True)

    film: Mapped["Film"] = relationship("Film", back_populates="imdb_vote_snapshots")
