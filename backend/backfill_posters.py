"""One-off maintenance script: backfill poster_url / backdrop_url for films missing them.

Films created from audience conversation (discovery) or synced while TMDB was
unreachable are stored without poster images. This script searches TMDB for each
film missing a poster and persists the CDN URLs so the frontend can render them
instantly instead of doing a slow per-card proxy search.

TMDB lookups run in parallel HTTP threads; all DB writes happen sequentially in
the main thread (SQLAlchemy sessions are not thread-safe).

Usage:
    .venv/Scripts/python.exe backfill_posters.py [--dry-run]
"""
from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import Film  # noqa: E402

TMDB_IMG = "https://image.tmdb.org/t/p"
WORKERS = 6


def search_poster(client: httpx.Client, title: str, year: int | None) -> tuple[str | None, str | None]:
    """Return (poster_path, backdrop_path) for the best TMDB match, or (None, None)."""
    base = "https://api.themoviedb.org/3/search/movie"
    params: dict = {"api_key": settings.tmdb_api_key, "query": title}
    if year:
        params["year"] = year
    r = client.get(base, params=params)
    if r.status_code != 200:
        return None, None
    results = r.json().get("results", [])
    if not results:
        # Retry without the year filter — regional/alternate release years miss it.
        if year:
            r = client.get(base, params={"api_key": settings.tmdb_api_key, "query": title})
            if r.status_code == 200:
                results = r.json().get("results", [])
    if not results:
        return None, None
    best = results[0]
    return best.get("poster_path"), best.get("backdrop_path")


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    db: Session = SessionLocal()
    films = db.query(Film).filter(Film.poster_url.is_(None)).order_by(Film.id).all()
    if not films:
        print("No films missing posters. Nothing to do.")
        return
    print(f"{len(films)} films missing posters" + (" (dry run)" if dry_run else ""))

    # Phase 1 — parallel HTTP lookups, no DB access from worker threads.
    lookups: dict[int, tuple[str | None, str | None] | None] = {}
    with ThreadPoolExecutor(max_workers=WORKERS) as pool, httpx.Client(timeout=25) as client:
        futures = {pool.submit(search_poster, client, f.title, f.year): f.id for f in films}
        for future in as_completed(futures):
            film_id = futures[future]
            try:
                lookups[film_id] = future.result()
            except Exception as exc:  # noqa: BLE001
                print(f"  error: film #{film_id}: {exc}")
                lookups[film_id] = None

    # Phase 2 — apply to the DB sequentially.
    updated = 0
    for film in films:
        result = lookups.get(film.id)
        if not result or (not result[0] and not result[1]):
            print(f"  no result: {film.title} ({film.year})")
            continue
        poster, backdrop = result
        if poster and not film.poster_url:
            film.poster_url = f"{TMDB_IMG}/w500{poster}"
        if backdrop and not film.backdrop_url:
            film.backdrop_url = f"{TMDB_IMG}/w1280{backdrop}"
        updated += 1
        if not dry_run:
            db.commit()
        print(f"  [{updated}] ok: {film.title} ({film.year})")
        time.sleep(0.05)

    db.close()
    print(f"Done — posters available for {updated}/{len(films)} films.")


if __name__ == "__main__":
    main()
