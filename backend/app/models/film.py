from datetime import datetime, date
from sqlalchemy import String, Integer, Text, DateTime, Date, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Film(Base):
    __tablename__ = "films"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, unique=True, index=True)
    director: Mapped[str | None] = mapped_column(String(255))
    year: Mapped[int | None] = mapped_column(Integer)
    runtime_min: Mapped[int | None] = mapped_column(Integer)
    country_origin: Mapped[str | None] = mapped_column(String(4))
    poster_url: Mapped[str | None] = mapped_column(String(500))
    backdrop_url: Mapped[str | None] = mapped_column(String(500))
    synopsis: Mapped[str | None] = mapped_column(Text)
    gradient_from: Mapped[str | None] = mapped_column(String(20))
    gradient_to: Mapped[str | None] = mapped_column(String(20))
    release_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    aliases: Mapped[list["FilmAlias"]] = relationship(back_populates="film", cascade="all, delete-orphan")


class FilmAlias(Base):
    __tablename__ = "film_aliases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    film_id: Mapped[int] = mapped_column(ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    alias: Mapped[str] = mapped_column(String(255), nullable=False)

    film: Mapped[Film] = relationship(back_populates="aliases")
