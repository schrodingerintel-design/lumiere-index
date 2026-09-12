"""IMDb dataset enrichment service.

Features:
  1. Streaming TSV.gz parsing for official IMDb datasets:
     - title.basics.tsv.gz (tconst, primaryTitle, originalTitle, startYear, runtimeMinutes, genres)
     - title.ratings.tsv.gz (tconst, averageRating, numVotes)
  2. Safe null handling: treats '\\N' as None and validates tconst syntax (^tt\\d+$).
  3. Strict identity matching: matches films via stored imdb_id / tconst.
     Never matches by title alone when an IMDb ID is available.
  4. Resolves TMDB-to-IMDb external IDs when film.imdb_id is missing.
  5. Transactional & idempotent imports: failures roll back, preserving previous valid data.
  6. Phase 3 Experimental vote-count snapshots (vote_growth, vote_velocity).
     Gated behind ENABLE_IMDB_MOMENTUM=false (0% effect on official rankings).
"""
from __future__ import annotations

import csv
import gzip
import io
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Generator, Iterable, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Film
from app.models.imdb import IMDbEnrichment, IMDbVoteSnapshot

log = logging.getLogger(__name__)

TCONST_PATTERN = re.compile(r"^tt\d+$")
VALID_TITLE_TYPES = {"movie", "tvMovie", "tvSeries", "tvMiniSeries"}


def _safe_int(val: str | None) -> int | None:
    if not val or val == r"\N" or val == "\\N":
        return None
    try:
        return int(val.strip())
    except (ValueError, TypeError):
        return None


def _safe_float(val: str | None) -> float | None:
    if not val or val == r"\N" or val == "\\N":
        return None
    try:
        return float(val.strip())
    except (ValueError, TypeError):
        return None


def _safe_str(val: str | None) -> str | None:
    if not val or val == r"\N" or val == "\\N":
        return None
    cleaned = val.strip()
    return cleaned if cleaned else None


class IMDbDatasetImporter:
    """Streams and ingests official IMDb TSV.gz datasets into the database."""

    @staticmethod
    def stream_tsv(source: str | io.IOBase) -> Generator[list[str], None, None]:
        """Stream lines from a .tsv or .tsv.gz file or file-like object.

        Memory efficient: never reads multi-gigabyte files into RAM all at once.
        """
        if isinstance(source, io.IOBase):
            # Already a file-like object
            wrapper = io.TextIOWrapper(source, encoding="utf-8", errors="replace") if isinstance(source, (io.RawIOBase, io.BufferedIOBase)) else source
            reader = csv.reader(wrapper, delimiter="\t", quoting=csv.QUOTE_NONE)
            for row in reader:
                yield row
            return

        if not os.path.exists(source):
            raise FileNotFoundError(f"IMDb dataset file not found: {source}")

        if source.endswith(".gz"):
            with gzip.open(source, mode="rt", encoding="utf-8", errors="replace") as f:
                reader = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
                for row in reader:
                    yield row
        else:
            with open(source, mode="r", encoding="utf-8", errors="replace") as f:
                reader = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
                for row in reader:
                    yield row

    @classmethod
    def parse_basics_row(cls, row: list[str]) -> dict[str, Any] | None:
        """Parse one row of title.basics.tsv.

        Columns: tconst, titleType, primaryTitle, originalTitle, isAdult, startYear, endYear, runtimeMinutes, genres
        """
        if not row or len(row) < 9:
            return None
        tconst = row[0].strip()
        if not TCONST_PATTERN.match(tconst):
            return None

        title_type = row[1].strip()
        if title_type not in VALID_TITLE_TYPES:
            return None

        return {
            "imdb_id": tconst,
            "primary_title": _safe_str(row[2]),
            "original_title": _safe_str(row[3]),
            "start_year": _safe_int(row[5]),
            "runtime_minutes": _safe_int(row[7]),
            "genres": _safe_str(row[8]),
        }

    @classmethod
    def parse_ratings_row(cls, row: list[str]) -> dict[str, Any] | None:
        """Parse one row of title.ratings.tsv.

        Columns: tconst, averageRating, numVotes
        """
        if not row or len(row) < 3:
            return None
        tconst = row[0].strip()
        if not TCONST_PATTERN.match(tconst):
            return None

        avg_rating = _safe_float(row[1])
        num_votes = _safe_int(row[2])

        if avg_rating is None or num_votes is None:
            return None

        return {
            "imdb_id": tconst,
            "average_rating": avg_rating,
            "num_votes": num_votes,
        }

    @classmethod
    def resolve_film_imdb_id(
        cls,
        db: Session,
        film: Film,
        tmdb_api_key: str | None = None,
    ) -> str | None:
        """Resolve film's stored imdb_id, querying TMDB external_ids if not yet present.

        Never matches by title alone when an IMDb ID is available.
        """
        if film.imdb_id:
            return film.imdb_id

        if not film.tmdb_id:
            return None

        api_key = tmdb_api_key or settings.tmdb_api_key
        if not api_key:
            return None

        endpoint = "tv" if film.content_type == "TV_SHOW" else "movie"
        url = f"https://api.themoviedb.org/3/{endpoint}/{film.tmdb_id}/external_ids"
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, params={"api_key": api_key})
                if resp.status_code == 200:
                    ext = resp.json()
                    imdb_id = ext.get("imdb_id")
                    if imdb_id and TCONST_PATTERN.match(imdb_id):
                        film.imdb_id = imdb_id
                        db.commit()
                        log.info("imdb_service: resolved %s (tmdb_id=%s) -> %s", film.title, film.tmdb_id, imdb_id)
                        return imdb_id
        except Exception as exc:
            log.warning("imdb_service: TMDB external_ids failed for film %s: %s", film.id, exc)

        return None

    @classmethod
    def import_datasets(
        cls,
        db: Session,
        ratings_source: str | io.IOBase,
        basics_source: str | io.IOBase | None = None,
        target_film_ids: Optional[Iterable[int]] = None,
        batch_size: int = 500,
    ) -> dict[str, int]:
        """Import IMDb ratings & basics into imdb_enrichments transactionally.

        Guarantees:
          - Atomicity: Wrapped in a database transaction. If an error occurs,
            the transaction rolls back and the previous valid dataset remains.
          - Idempotency: Duplicate tconst entries update existing rows.
          - Streaming & Memory efficient: Reads row-by-row.
        """
        now = datetime.now(timezone.utc)
        stats = {
            "ratings_read": 0,
            "ratings_matched": 0,
            "basics_read": 0,
            "records_upserted": 0,
            "snapshots_created": 0,
        }

        # 1. Build map of tracked catalog films: imdb_id -> Film
        films_query = db.query(Film)
        if target_film_ids:
            films_query = films_query.filter(Film.id.in_(target_film_ids))
        catalog_films = films_query.all()

        tracked_imdb_map: dict[str, Film] = {}
        for f in catalog_films:
            if f.imdb_id:
                tracked_imdb_map[f.imdb_id] = f

        # If some films don't have imdb_id yet, resolve via TMDB
        for f in catalog_films:
            if not f.imdb_id and f.tmdb_id:
                resolved_id = cls.resolve_film_imdb_id(db, f)
                if resolved_id:
                    tracked_imdb_map[resolved_id] = f

        if not tracked_imdb_map:
            log.info("imdb_service: no films with imdb_id found in catalog")

        # 2. Stream ratings (title.ratings.tsv.gz)
        matched_ratings: dict[str, dict[str, Any]] = {}
        ratings_stream = cls.stream_tsv(ratings_source)
        # Skip header if present
        header = next(ratings_stream, None)
        if header and header[0].lower() != "tconst":
            # First row was data, parse it
            p = cls.parse_ratings_row(header)
            if p and (not tracked_imdb_map or p["imdb_id"] in tracked_imdb_map):
                matched_ratings[p["imdb_id"]] = p

        for row in ratings_stream:
            stats["ratings_read"] += 1
            parsed = cls.parse_ratings_row(row)
            if not parsed:
                continue

            tconst = parsed["imdb_id"]
            # Filter to catalog films
            if tracked_imdb_map and tconst not in tracked_imdb_map:
                continue

            matched_ratings[tconst] = parsed
            stats["ratings_matched"] += 1

        # 3. Optional: Stream basics (title.basics.tsv.gz) for metadata (runtime, genres, titles)
        matched_basics: dict[str, dict[str, Any]] = {}
        if basics_source:
            basics_stream = cls.stream_tsv(basics_source)
            b_header = next(basics_stream, None)
            if b_header and b_header[0].lower() != "tconst":
                p = cls.parse_basics_row(b_header)
                if p and p["imdb_id"] in matched_ratings:
                    matched_basics[p["imdb_id"]] = p

            for row in basics_stream:
                stats["basics_read"] += 1
                parsed = cls.parse_basics_row(row)
                if not parsed:
                    continue

                tconst = parsed["imdb_id"]
                if tconst in matched_ratings or tconst in tracked_imdb_map:
                    matched_basics[tconst] = parsed

        # 4. Transactional Upsert: all-or-nothing
        try:
            # We use savepoint/nested transaction so previous valid dataset stays if error occurs
            with db.begin_nested():
                all_tconsts = set(matched_ratings.keys()) | (set(matched_basics.keys()) & set(tracked_imdb_map.keys()))

                # Load existing enrichments
                existing_map: dict[str, IMDbEnrichment] = {
                    e.imdb_id: e
                    for e in db.query(IMDbEnrichment).filter(IMDbEnrichment.imdb_id.in_(all_tconsts)).all()
                }

                for tconst in all_tconsts:
                    r_data = matched_ratings.get(tconst, {})
                    b_data = matched_basics.get(tconst, {})
                    film = tracked_imdb_map.get(tconst)
                    film_id = film.id if film else None
                    tmdb_id = film.tmdb_id if film else None

                    rec = existing_map.get(tconst)
                    if rec:
                        # Update existing
                        if film_id:
                            rec.film_id = film_id
                        if tmdb_id:
                            rec.tmdb_movie_id = tmdb_id
                        if "average_rating" in r_data:
                            rec.average_rating = r_data["average_rating"]
                        if "num_votes" in r_data:
                            rec.num_votes = r_data["num_votes"]
                        if b_data.get("primary_title"):
                            rec.primary_title = b_data["primary_title"]
                        if b_data.get("original_title"):
                            rec.original_title = b_data["original_title"]
                        if b_data.get("start_year"):
                            rec.start_year = b_data["start_year"]
                        if b_data.get("runtime_minutes"):
                            rec.runtime_minutes = b_data["runtime_minutes"]
                        if b_data.get("genres"):
                            rec.genres = b_data["genres"]
                        rec.dataset_updated_at = now
                    else:
                        # Insert new
                        rec = IMDbEnrichment(
                            film_id=film_id,
                            tmdb_movie_id=tmdb_id,
                            imdb_id=tconst,
                            average_rating=r_data.get("average_rating"),
                            num_votes=r_data.get("num_votes"),
                            primary_title=b_data.get("primary_title") or (film.title if film else None),
                            original_title=b_data.get("original_title") or (film.original_title if film else None),
                            start_year=b_data.get("start_year") or (film.year if film else None),
                            runtime_minutes=b_data.get("runtime_minutes") or (film.runtime_min if film else None),
                            genres=b_data.get("genres") or (film.genre_tag if film else None),
                            imported_at=now,
                            dataset_updated_at=now,
                        )
                        db.add(rec)
                        existing_map[tconst] = rec

                    stats["records_upserted"] += 1

                    # Phase 3: Record vote snapshot if film is attached
                    if film_id and r_data.get("num_votes") is not None:
                        created = cls.record_vote_snapshot(
                            db,
                            film_id=film_id,
                            imdb_id=tconst,
                            num_votes=r_data["num_votes"],
                            average_rating=r_data.get("average_rating"),
                            snapshot_at=now,
                        )
                        if created:
                            stats["snapshots_created"] += 1

            db.commit()
            log.info("imdb_service: import complete — %s", stats)
            return stats
        except Exception as exc:
            db.rollback()
            log.exception("imdb_service: dataset import failed, rolled back to preserve existing data — %s", exc)
            raise

    @classmethod
    def record_vote_snapshot(
        cls,
        db: Session,
        film_id: int,
        imdb_id: str,
        num_votes: int,
        average_rating: float | None = None,
        snapshot_at: datetime | None = None,
    ) -> bool:
        """Record an IMDb vote snapshot and compute delta / velocity from previous snapshot."""
        now = snapshot_at or datetime.now(timezone.utc)

        prev = (
            db.query(IMDbVoteSnapshot)
            .filter_by(film_id=film_id)
            .order_by(IMDbVoteSnapshot.snapshot_at.desc())
            .first()
        )

        vote_growth = 0
        vote_velocity = 0.0
        elapsed_days = 0.0

        if prev:
            prev_ts = prev.snapshot_at
            if prev_ts.tzinfo is None:
                prev_ts = prev_ts.replace(tzinfo=timezone.utc)
            current_ts = now if now.tzinfo is not None else now.replace(tzinfo=timezone.utc)
            elapsed_days = max((current_ts - prev_ts).total_seconds() / 86400.0, 0.001)
            vote_growth = max(num_votes - prev.num_votes, 0)
            vote_velocity = round(vote_growth / elapsed_days, 2)

        snap = IMDbVoteSnapshot(
            film_id=film_id,
            imdb_id=imdb_id,
            num_votes=num_votes,
            average_rating=average_rating,
            vote_growth=vote_growth,
            vote_velocity=vote_velocity,
            elapsed_days=round(elapsed_days, 3),
            snapshot_at=now,
        )
        db.add(snap)
        return True

    @classmethod
    def get_film_imdb_momentum(cls, db: Session, film_id: int) -> dict[str, Any] | None:
        """Return experimental IMDb momentum diagnostics for a film.

        Phase 3: Gated behind ENABLE_IMDB_MOMENTUM=false.
        Returns None when disabled or no snapshot data exists.
        """
        if not settings.enable_imdb_momentum:
            return None

        latest_snap = (
            db.query(IMDbVoteSnapshot)
            .filter_by(film_id=film_id)
            .order_by(IMDbVoteSnapshot.snapshot_at.desc())
            .first()
        )
        if not latest_snap:
            return None

        return {
            "imdb_id": latest_snap.imdb_id,
            "num_votes": latest_snap.num_votes,
            "vote_growth": latest_snap.vote_growth,
            "vote_velocity": latest_snap.vote_velocity,
            "elapsed_days": latest_snap.elapsed_days,
            "snapshot_at": latest_snap.snapshot_at.isoformat(),
            "is_experimental": True,
            "used_in_ranking": False,  # Explicit audit field
        }


imdb_service = IMDbDatasetImporter()
