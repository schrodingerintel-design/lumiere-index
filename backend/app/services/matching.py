"""Resolve free text to a Film via context-aware title/alias matching."""
from __future__ import annotations
import re
from sqlalchemy.orm import Session
from app.models import Film, FilmAlias

# Context words that indicate a film discussion
_CINEMA_CONTEXT = re.compile(
    r"\b(film|movie|cinema|movies|films|directed|director|watch(?:ed|ing)?|"
    r"review|trailer|streaming|theater|theatre|screening|box\s*office|"
    r"oscar|award|imdb|rotten\s*tomatoes|season|series|episode)\b",
    re.IGNORECASE,
)

# Short titles that are extremely common English words — require extra context
_AMBIGUOUS_TITLES: frozenset[str] = frozenset({
    "us", "it", "air", "him", "her", "love", "life", "ride", "rush",
    "the", "a", "an", "smile", "vice", "heat", "raw", "wild", "real",
    "nope", "men", "drive", "trap", "fall",
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
            # Also index title + year (e.g. "Dune 2021" or "Dune (2021)")
            if f.year:
                self._index.append((f"{f.title.lower()} ({f.year})", f.id))
                self._index.append((f"{f.title.lower()} {f.year}", f.id))
        for a in aliases:
            self._index.append((a.alias.lower(), a.film_id))
        # Longer aliases matched first to avoid substring collisions
        self._index.sort(key=lambda x: -len(x[0]))

    def match(self, text: str) -> int | None:
        if not text:
            return None
        t = text.lower()

        for alias, fid in self._index:
            # Word boundary search prevents partial matches (e.g. "us" matching "genius")
            pattern = rf"\b{re.escape(alias)}\b"
            match_obj = re.search(pattern, t)
            if not match_obj:
                continue

            pos = match_obj.start()

            # For short / ambiguous titles, require cinema context, director name, or year nearby
            if alias in _AMBIGUOUS_TITLES:
                snippet = t[max(0, pos - _CONTEXT_WINDOW) : pos + len(alias) + _CONTEXT_WINDOW]
                has_cinema_context = bool(_CINEMA_CONTEXT.search(snippet))

                meta = self._film_meta.get(fid)
                director_match = False
                year_match = False
                if meta:
                    _, director_lower, year = meta
                    if director_lower and len(director_lower) > 4 and director_lower in t:
                        director_match = True
                    if year and str(year) in snippet:
                        year_match = True

                if not (has_cinema_context or director_match or year_match):
                    continue

            # Optional director context boost (trust it if present)
            meta = self._film_meta.get(fid)
            if meta:
                _, director_lower, _ = meta
                if director_lower and len(director_lower) > 4 and director_lower in t:
                    return fid

            return fid

        return None
