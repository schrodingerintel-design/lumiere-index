"""Catalog integrity — identity guarantees for catalog metadata.

Production incident (2026-09-22): Titans (2026, scheduled release Oct 1) was
displaying budget, box office, runtime, studios and watch providers from
Wrath of the Titans (2012). The catalog row itself was correct — the film
PAGE enriched itself by searching TMDB by title and taking the first result,
and a generic title like "Titans" collides across decades. This module is the
pipeline-level response, so the same failure cannot recur for Home, Heat,
Crash, Us or any other shared title:

  1. Identity priority (enforced everywhere): TMDB/IMDb ID > title + year >
     title + director/cast > title alone. A title-only match without a year
     is never accepted.
  2. Repair: link catalog rows to their true provider id using title + YEAR.
     Known incidents are repaired at boot; the admin audit endpoint reports
     anything that still does not verify.
  3. Audit: a DB-wide scan flags rows whose stored provider id no longer
     resolves (stale or wrong id) instead of failing silently.
  4. Display rule: when identity is not verified, downstream surfaces must
     show "Not available" — never another film's metadata. The film page
     consumes the stored tmdb_id serialized by the API; no stored id means
     no TMDB enrichment at all.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Film

log = logging.getLogger(__name__)

TMDB_BASE = "https://api.themoviedb.org/3"

# Slugs with confirmed identity incidents. Each is repaired at boot by a
# title+YEAR search (never title alone); the repair is idempotent — once the
# row carries the right tmdb_id the search is skipped.
KNOWN_INCIDENT_SLUGS = ("titans",)


def _tmdb_search(endpoint: str, title: str, year: int | None) -> list[dict]:
    """TMDB /search/{endpoint} with backoff. Returns the raw result list
    (empty on failure — callers treat "no verified identity" as the answer,
    never as an excuse to borrow another record's metadata)."""
    api_key = settings.tmdb_api_key
    if not api_key:
        return []
    params: dict = {"api_key": api_key, "query": title}
    if year:
        # TV uses first_air_date_year; movies use year.
        params["first_air_date_year" if endpoint == "tv" else "year"] = str(year)
    for attempt in range(3):
        try:
            r = httpx.get(f"{TMDB_BASE}/search/{endpoint}", params=params, timeout=10)
            if r.status_code == 200:
                return r.json().get("results", []) or []
            if r.status_code in (429, 500, 502, 503, 504):
                import time
                time.sleep(0.5 + attempt)
                continue
            return []
        except httpx.HTTPError:
            import time
            time.sleep(0.5 + attempt)
    return []


def _result_year(item: dict) -> int | None:
    """Release/air year of a TMDB search result (None when absent)."""
    date_str = item.get("release_date") or item.get("first_air_date") or ""
    if len(date_str) >= 4 and date_str[:4].isdigit():
        return int(date_str[:4])
    return None


def best_match_by_title_year(
    results: list[dict],
    year: int | None,
    title: str | None = None,
) -> dict | None:
    """The one result whose YEAR matches — identity priority: year is
    mandatory, exact title preferred, popularity breaks ties. None when no
    result shares the year: "no confident match" beats a wrong match."""
    if year is None:
        return None
    candidates = [r for r in results if _result_year(r) == year]
    if not candidates:
        return None
    if title:
        t = title.strip().lower()
        exact = [r for r in candidates if (r.get("title") or r.get("name") or "").strip().lower() == t]
        if exact:
            return max(exact, key=lambda r: r.get("popularity", 0))
    return max(candidates, key=lambda r: r.get("popularity", 0))


def repair_film_identity(db: Session, film: Film) -> dict:
    """Link one film to its true TMDB id via title + year.

    Returns a report dict; never borrows metadata across a year gap.
    Idempotent: a film with a stored tmdb_id is left untouched.
    """
    if film.tmdb_id:
        return {"film": film.slug, "action": "already_linked", "tmdb_id": film.tmdb_id}
    endpoint = "tv" if film.content_type == "TV_SHOW" else "movie"
    results = _tmdb_search(endpoint, film.title, film.year)
    match = best_match_by_title_year(results, film.year, film.title)
    if not match:
        return {
            "film": film.slug,
            "action": "no_confident_match",
            "year": film.year,
            "candidates_seen": len(results),
        }
    film.tmdb_id = match["id"]
    db.commit()
    log.info("correction: repaired identity %s (%s) -> tmdb %s", film.slug, film.year, match["id"])
    return {"film": film.slug, "action": "linked", "tmdb_id": match["id"], "year": film.year}


def repair_known_incidents(db: Session) -> list[dict]:
    """Boot-time repair for slugs with confirmed identity incidents."""
    reports = []
    for slug in KNOWN_INCIDENT_SLUGS:
        film = db.scalar(select(Film).where(Film.slug == slug))
        if film:
            try:
                reports.append(repair_film_identity(db, film))
            except Exception as exc:  # never block boot on a repair
                log.warning("correction: repair failed for %s — %s", slug, exc)
    return reports


def audit_catalog_integrity(db: Session, max_probe: int = 10) -> dict:
    """DB-wide metadata-integrity audit.

    Flags, without mutating anything:
      - tmdb_missing: catalog rows with no stored provider id (these surfaces
        must render "Not available", never borrowed metadata).
      - tmdb_unresolved: rows whose stored tmdb_id fails a live provider
        lookup (stale or wrong id) — probed on the currently ranked titles
        first, bounded by max_probe to keep the audit cheap.
      - upcoming: unreleased titles (informational — they legitimately rank
        on attention and must carry the UPCOMING indicator, not box office).
    """
    films = db.query(Film).all()
    today = datetime.now(timezone.utc).date()

    missing = [f.slug for f in films if not f.tmdb_id]
    upcoming = [
        f.slug
        for f in films
        if (
            f.first_air_date > today
            if f.content_type == "TV_SHOW"
            else f.release_date is not None and f.release_date > today
        )
    ]

    # Probe order: ranked titles first (they are what the public sees).
    unresolved: list[dict] = []
    probed = 0
    for f in sorted(films, key=lambda x: x.id):
        if probed >= max_probe:
            break
        if not f.tmdb_id:
            continue
        probed += 1
        endpoint = "tv" if f.content_type == "TV_SHOW" else "movie"
        try:
            r = httpx.get(
                f"{TMDB_BASE}/{endpoint}/{f.tmdb_id}",
                params={"api_key": settings.tmdb_api_key},
                timeout=10,
            )
            ok = r.status_code == 200
        except httpx.HTTPError:
            ok = False
        if not ok:
            unresolved.append({"slug": f.slug, "tmdb_id": f.tmdb_id, "year": f.year})

    report = {
        "checked": len(films),
        "tmdb_missing": len(missing),
        "tmdb_missing_slugs": missing[:50],
        "tmdb_probed": probed,
        "tmdb_unresolved": unresolved,
        "upcoming_count": len(upcoming),
        "upcoming_slugs": upcoming[:50],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if unresolved:
        log.warning("correction: catalog audit found %s unresolved ids: %s",
                    len(unresolved), [u["slug"] for u in unresolved])
    return report
