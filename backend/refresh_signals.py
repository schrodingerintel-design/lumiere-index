"""Refresh demo mention recency with realistic per-film variety, then recompute rankings.

Why this exists
---------------
The seeded catalog assigns each film a large block of mentions with a flat
0.5–48h recency spread. When the live sync + ranking engine recomputes over
that data, every top film ends up with ~identical 24h mention counts and zero
movement — so the "What's Trending" widget shows the *same* trend reason on
every card. Real social data has per-film velocity: some films burst recently,
some hold steady, some are cooling off.

This script gives each film a realistic recency profile (fresh burst / steady /
cooling), then recomputes a fresh ranking snapshot so movement values and trend
reasons are derived from genuinely varied signal data.

Safe to re-run: it only touches Mention timestamps + Ranking snapshots. It does
not delete or re-create films, so TMDB-synced films are preserved.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.models import Mention, Ranking
from app.services.ranking import recompute_rankings

# Roughly 40% of films are freshly bursting, 35% steady, 25% cooling —
# mirrors how a real audience signal feed looks on any given day. Profiles are
# assigned across ALL films (including the current leaders) so the ranking
# engine re-orders the chart and computes real, varied movement — which is what
# differentiates trend reasons in the UI. If only mid/lower films varied, the
# top cards would all sit at movement 0 with identical reasons again.
PROFILES = [
    ("burst", 0.40),
    ("steady", 0.35),
    ("cooling", 0.25),
]


def _profile_for_rank(rank: int, rng: random.Random) -> str:
    """Pick a recency profile for a film.

    The top ~24 films cycle deterministically through burst/steady/cooling so
    the home widget's visible cards reliably span different reason tiers
    (movement + volume) instead of all landing in one bucket. The rest use the
    weighted random mix.
    """
    if rank <= 24:
        return ("steady", "burst", "cooling")[(rank - 1) % 3]
    roll = rng.random()
    acc = 0.0
    for name, weight in PROFILES:
        acc += weight
        if roll <= acc:
            return name
    return "steady"


def _age_hours(profile: str, rng: random.Random) -> float:
    """Draw a mention age (hours) from the profile's distribution."""
    if profile == "burst":
        # Most mentions landed in the last few hours.
        return rng.expovariate(1 / 3.0)  # mean ~3h
    if profile == "cooling":
        # Mentions are mostly older than a day; few recent.
        return rng.uniform(20.0, 72.0)
    # steady — a normal 48h rolling window.
    return rng.uniform(0.5, 48.0)


def run() -> None:
    now = datetime.now(timezone.utc)
    rng = random.Random(2026)  # deterministic-ish for reproducibility

    with SessionLocal() as db:
        # Snapshot of current rank ordering (used only to shape the profiles).
        latest = db.query(Ranking).order_by(Ranking.snapshot_at.desc()).first()
        rank_of: dict[int, int] = {}
        if latest:
            rows = (
                db.query(Ranking)
                .filter(Ranking.snapshot_at == latest.snapshot_at)
                .order_by(Ranking.rank.asc())
                .all()
            )
            rank_of = {r.film_id: r.rank for r in rows}
        else:
            print("No existing snapshot — computing fresh profiles by film id order.")

        mentions = db.query(Mention).all()
        print(f"Refreshing recency for {len(mentions)} mentions across "
              f"{len(rank_of) or 'unknown'} films…")

        # Bulk-update in batches to keep the transaction light.
        batch: list[Mention] = []
        for m in mentions:
            rank = rank_of.get(m.film_id, 9999)
            profile = _profile_for_rank(rank, rng)
            age = _age_hours(profile, rng)
            m.created_at = now - timedelta(hours=age)
            batch.append(m)
            if len(batch) >= 2000:
                db.bulk_save_objects(batch)
                batch = []
        if batch:
            db.bulk_save_objects(batch)
        db.commit()
        print("Mention recency refreshed.")

        snap1 = recompute_rankings(db)
        print(f"Baseline snapshot written at {snap1}.")

    print("Done. The latest ranking snapshot now reflects varied per-film signal velocity.")


if __name__ == "__main__":
    run()
