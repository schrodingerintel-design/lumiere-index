from datetime import datetime, date
from sqlalchemy import String, Integer, Text, DateTime, Date, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

# First-class content types. TV shows are NOT a special case of movies — every
# catalog/signal/ranking consumer must branch on this field explicitly.
CONTENT_TYPES = ("MOVIE", "TV_SHOW")
CONTENT_TYPE_ALIASES = {
    "movie": "MOVIE",
    "movies": "MOVIE",
    "film": "MOVIE",
    "films": "MOVIE",
    "tv_show": "TV_SHOW",
    "tv": "TV_SHOW",
    "tvshow": "TV_SHOW",
    "show": "TV_SHOW",
}


def normalize_content_type(value: str | None) -> str | None:
    """Normalize a user/API-provided content type filter to MOVIE/TV_SHOW.

    Returns None for None/empty (meaning "no filter"). Unknown values raise
    ValueError so a typo like "tvshows" fails loudly instead of silently
    returning everything.
    """
    if value is None:
        return None
    key = value.strip().lower()
    if not key:
        return None
    if key in CONTENT_TYPE_ALIASES:
        return CONTENT_TYPE_ALIASES[key]
    raise ValueError(f"unknown content_type {value!r} — expected one of {CONTENT_TYPES}")


class Film(Base):
    __tablename__ = "films"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Original-language title from the catalog provider (display + matching).
    original_title: Mapped[str | None] = mapped_column(String(255))
    # MOVIE or TV_SHOW — see CONTENT_TYPES above. Indexed: every list endpoint
    # can filter by content type.
    content_type: Mapped[str] = mapped_column(String(16), default="MOVIE", nullable=False, index=True)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, index=True)
    director: Mapped[str | None] = mapped_column(String(255))
    year: Mapped[int | None] = mapped_column(Integer)
    runtime_min: Mapped[int | None] = mapped_column(Integer)
    country_origin: Mapped[str | None] = mapped_column(String(4))
    poster_url: Mapped[str | None] = mapped_column(String(500))
    backdrop_url: Mapped[str | None] = mapped_column(String(500))
    synopsis: Mapped[str | None] = mapped_column(Text)
    gradient_from: Mapped[str | None] = mapped_column(String(20))
    gradient_to: Mapped[str | None] = mapped_column(String(20))
    # Theatrical release date for MOVIE content.
    release_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # First-air date for TV_SHOW content. The ranking engine's recency (R)
    # component reads whichever of the two is set, so TV premieres are treated
    # with the same window as movie openings.
    first_air_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Single canonical genre tag (Action, Sci-Fi, Horror, Drama, Indie,
    # Animation, Romance, Comedy, Thriller…). The frontend groups collections
    # by this field and must never re-derive genres from synopsis substrings.
    genre_tag: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        # TMDB movie ids and TV ids are separate id spaces; uniqueness is
        # enforced per content type so /movie/123 and /tv/123 can coexist.
        UniqueConstraint("content_type", "tmdb_id", name="uq_films_content_type_tmdb"),
    )

    @property
    def air_date(self) -> date | None:
        """The date this title entered (or enters) the world — release_date for
        movies, first_air_date for shows. The ranking engine's recency window
        is content-type aware through this accessor."""
        return self.first_air_date if self.content_type == "TV_SHOW" else self.release_date

    aliases: Mapped[list["FilmAlias"]] = relationship(back_populates="film", cascade="all, delete-orphan")


class FilmAlias(Base):
    __tablename__ = "film_aliases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    alias: Mapped[str] = mapped_column(String(255), nullable=False)

    film: Mapped[Film] = relationship(back_populates="aliases")
