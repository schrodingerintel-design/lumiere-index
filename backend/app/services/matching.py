"""Resolve free text to a Film via context-aware title/alias matching."""
from __future__ import annotations
import re
from sqlalchemy.orm import Session
from app.models import Film, FilmAlias

# Context words that indicate a film discussion
_CINEMA_CONTEXT = re.compile(
    r"\b(film|movie|cinema|movies|films|directed|director|watch(?:ed|ing)?|"
    r"review|trailer|streaming|theater|theatre|screening|box\s*office|"
    r"oscar|award|imdb|rotten\s*tomatoes)\b",
    re.IGNORECASE,
)

# Short titles that are extremely common English words — require extra context
_AMBIGUOUS_TITLES: frozenset[str] = frozenset({
    "us", "it", "air", "him", "her", "love", "life", "ride", "rush",
    "the", "a", "an", "smile", "vice", "heat", "raw", "wild", "real",
})

# Minimum surrounding context window (chars) to look for cinema words
_CONTEXT_WINDOW = 200


class FilmMatcher:
    def __init__(self, db: Session):
        rows = db.query(Film).all()
        aliases = db.query(FilmAlias).all()
        # Build a map of film_id → (title, director, year) for context boosting
        self._film_meta: dict[int, tuple[str, str | None, int | None]] = {
            f.id: (f.title.lower(), (f.director or "").lower(), f.year)
            for f in rows
        }
        self._index: list[tuple[str, int]] = []
        for f in rows:
            self._index.append((f.title.lower(), f.id))
        for a in aliases:
            self._index.append((a.alias.lower(), a.film_id))
        # Longer aliases matched first to avoid substring collisions
        self._index.sort(key=lambda x: -len(x[0]))

    def match(self, text: str) -> int | None:
        if not text:
            return None
        t = text.lower()

        for alias, fid in self._index:
            if alias not in t:
                continue

            # For very short / ambiguous titles, require cinema context nearby
            if alias in _AMBIGUOUS_TITLES:
                pos = t.find(alias)
                snippet = t[max(0, pos - _CONTEXT_WINDOW) : pos + len(alias) + _CONTEXT_WINDOW]
                if not _CINEMA_CONTEXT.search(snippet):
                    continue

            # Optional director context boost (not required, but helps precision)
            # If we have director info and it appears in the text — high confidence
            meta = self._film_meta.get(fid)
            if meta:
                _, director_lower, _ = meta
                # Director match is strong signal — trust it even for short titles
                if director_lower and len(director_lower) > 4 and director_lower in t:
                    return fid

            return fid

        return None
