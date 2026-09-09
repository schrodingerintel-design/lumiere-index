"""Official Index publication layer — daily/weekly snapshots, movers, debuts.

Separation of concerns (the architectural rule this module enforces):

  continuous computation  — `rankings` table, recomputed every refresh cycle
                            by app.services.ranking.recompute_rankings. Never
                            shown as "the official chart".
  official publication    — `daily_index_snapshots`, written once per day from
                            the latest computed snapshot (with validation).
  weekly publication      — `weekly_index_snapshots`, once per ISO week,
                            aggregated from daily signal measurements over
                            the week window (NOT a copy of any daily chart).
  derived products        — Biggest Movers (rank deltas between published
                            dailies) and New Entries (first appearances,
                            enforced unique per film by `index_debuts`).

All publish functions are idempotent: unique constraints + existence checks
make re-running on the same date/week a no-op.  Validation runs BEFORE any
write; a failed validation leaves the previous valid snapshot untouched.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    DailyIndexSnapshot,
    DailyScore,
    Film,
    Mention,
    IndexDebut,
    Ranking,
    Source,
    WeeklyIndexSnapshot,
)
from app.services.confidence import CATALOG_ONLY_SOURCE_KEYS

log = logging.getLogger(__name__)

CHART_SIZE = 100


class SnapshotValidationError(Exception):
    """Raised when a candidate ranking fails publication validation."""


# ── validation ───────────────────────────────────────────────────────────────

def _validate_ranking_rows(rows: list[tuple[Film, Ranking]]) -> None:
    """Validate a candidate (film, ranking) list before publishing.

    Checks the full data-integrity contract; raises SnapshotValidationError
    with a specific reason on the first violation.  The caller must NOT write
    anything when this raises.
    """
    if not rows:
        raise SnapshotValidationError("no ranked rows to publish")

    seen_films: set[int] = set()
    seen_ranks: set[int] = set()
    prev_rank = 0
    for film, r in rows:
        if film.id in seen_films:
            raise SnapshotValidationError(f"duplicate film id {film.id}")
        if r.rank in seen_ranks:
            raise SnapshotValidationError(f"duplicate rank {r.rank} (film {film.id})")
        seen_films.add(film.id)
        seen_ranks.add(r.rank)

        if r.rank <= prev_rank:
            raise SnapshotValidationError(
                f"ranks not sequential ascending at rank {r.rank} (prev {prev_rank})"
            )
        prev_rank = r.rank

        if not (1 <= r.rank <= CHART_SIZE):
            raise SnapshotValidationError(f"rank {r.rank} outside 1..{CHART_SIZE}")

        if not isinstance(r.score, (int, float)) or r.score < 0 or r.score > 100:
            raise SnapshotValidationError(f"invalid score {r.score!r} for film {film.id}")

        if film.id is None:
            raise SnapshotValidationError("ranking row references missing film")
        if not (film.title or "").strip():
            raise SnapshotValidationError(f"film {film.id} has empty title")
        if film.release_date is not None and film.year is None:
            # release_date present but year missing — metadata gap
            raise SnapshotValidationError(f"film {film.id} has release_date but no year")


def _validate_daily_snapshot_rows(db: Session, snapshot_date: date) -> None:
    """Post-write integrity check on what actually landed in the DB."""
    rows = db.query(DailyIndexSnapshot).filter(
        DailyIndexSnapshot.snapshot_date == snapshot_date
    ).order_by(DailyIndexSnapshot.rank).all()
    ranks = [r.rank for r in rows]
    if len(ranks) != len(set(ranks)):
        raise SnapshotValidationError("published rows contain duplicate ranks")
    if ranks != list(range(1, len(ranks) + 1)):
        raise SnapshotValidationError(f"published ranks not sequential: {ranks[:10]}…")
    film_ids = {r.film_id for r in rows}
    existing = {
        fid for (fid,) in db.query(Film.id).filter(Film.id.in_(film_ids)).all()
    }
    missing = film_ids - existing
    if missing:
        raise SnapshotValidationError(f"published rows reference missing films: {sorted(missing)[:5]}")


# ── helpers ──────────────────────────────────────────────────────────────────

def _latest_continuous_ranking(db: Session) -> list[tuple[Film, Ranking]]:
    """The freshest rows from the continuous computation layer."""
    snap = db.scalar(select(func.max(Ranking.snapshot_at)))
    if snap is None:
        return []
    return (
        db.query(Film, Ranking)
        .join(Ranking, Ranking.film_id == Film.id)
        .filter(Ranking.snapshot_at == snap)
        .order_by(Ranking.rank.asc())
        .all()
    )


def _previous_published_ranks(db: Session, before_date: date) -> dict[int, int]:
    """Most recent published daily rank per film strictly before `before_date`."""
    rows = db.query(
        DailyIndexSnapshot.film_id,
        DailyIndexSnapshot.rank,
    ).filter(DailyIndexSnapshot.snapshot_date < before_date).all()
    return {fid: rank for fid, rank in rows}


def _catalog_source_ids(db: Session) -> list[int]:
    """Ids of catalog-only sources ("tmdb") — excluded from every signal
    aggregate below so TMDB can never influence a published Index."""
    return [
        sid for (sid,) in db.query(Source.id).filter(Source.key.in_(CATALOG_ONLY_SOURCE_KEYS)).all()
    ]


def _source_coverage(db: Session, film_ids: list[int]) -> dict[int, int]:
    """Distinct source count per film over the last 30 days.

    Catalog-only sources ("tmdb") never count as coverage — knowing a title's
    metadata is not evidence of cultural attention."""
    if not film_ids:
        return {}
    since = datetime.now(timezone.utc) - timedelta(days=30)
    q = (
        db.query(Mention.film_id, func.count(func.distinct(Mention.source_id)))
        .filter(Mention.film_id.in_(film_ids), Mention.created_at >= since)
    )
    catalog_ids = _catalog_source_ids(db)
    if catalog_ids:
        q = q.filter(~Mention.source_id.in_(catalog_ids))
    rows = q.group_by(Mention.film_id).all()
    return {fid: int(cnt or 0) for fid, cnt in rows}


def _sentiment_split(db: Session, film_ids: list[int]) -> dict[int, tuple[float, float, float]]:
    """Positive/neutral/negative percentage split per film (last 30 days).

    Catalog-only sources are excluded: TMDB rating rows carry a synthetic
    sentiment derived from vote averages, which is metadata — not audience
    conversation."""
    if not film_ids:
        return {}
    since = datetime.now(timezone.utc) - timedelta(days=30)
    q = (
        db.query(
            Mention.film_id,
            Mention.sentiment_label,
            func.count(Mention.id),
        )
        .filter(Mention.film_id.in_(film_ids), Mention.created_at >= since)
    )
    catalog_ids = _catalog_source_ids(db)
    if catalog_ids:
        q = q.filter(~Mention.source_id.in_(catalog_ids))
    rows = q.group_by(Mention.film_id, Mention.sentiment_label).all()
    counts: dict[int, dict[str, int]] = {}
    for fid, label, cnt in rows:
        counts.setdefault(fid, {})[label or "neutral"] = int(cnt or 0)
    out: dict[int, tuple[float, float, float]] = {}
    for fid, c in counts.items():
        total = max(sum(c.values()), 1)
        out[fid] = (
            100.0 * c.get("positive", 0) / total,
            100.0 * c.get("neutral", 0) / total,
            100.0 * c.get("negative", 0) / total,
        )
    return out


# ── daily publication ────────────────────────────────────────────────────────

def publish_daily_index(db: Session, publish_date: date | None = None) -> date | None:
    """Publish the official Daily Index for `publish_date` (default: today UTC).

    Idempotent: if a snapshot for this date already exists, return None (no
    duplicate publication).  Validates before writing; on post-write failure
    the transaction is rolled back so the previous valid snapshot survives.

    Returns the publication date on success, None when already published or
    when there is nothing to publish.
    """
    target_date = publish_date or datetime.now(timezone.utc).date()

    existing = db.query(DailyIndexSnapshot.id).filter(
        DailyIndexSnapshot.snapshot_date == target_date
    ).first()
    if existing:
        log.info("publish_daily: %s already published — skipping", target_date)
        return None

    ranked = _latest_continuous_ranking(db)
    if not ranked:
        log.warning("publish_daily: no continuous ranking snapshot available")
        return None

    top = [(f, r) for f, r in ranked[:CHART_SIZE]]
    try:
        _validate_ranking_rows(top)
    except SnapshotValidationError as exc:
        # Do not publish corrupted rankings — keep the previous valid snapshot.
        log.error("publish_daily: validation FAILED for %s — %s", target_date, exc)
        return None

    now = datetime.now(timezone.utc)
    prev_ranks = _previous_published_ranks(db, target_date)
    prev_scores = {
        fid: score
        for fid, score in db.query(
            DailyIndexSnapshot.film_id, DailyIndexSnapshot.score
        ).filter(DailyIndexSnapshot.snapshot_date < target_date).all()
    }
    coverage = _source_coverage(db, [f.id for f, _ in top])
    sentiment = _sentiment_split(db, [f.id for f, _ in top])

    try:
        for film, r in top:
            prev_rank = prev_ranks.get(film.id)
            rank_delta = (prev_rank - r.rank) if prev_rank is not None else 0
            prev_score = prev_scores.get(film.id)
            db.add(DailyIndexSnapshot(
                snapshot_date=target_date,
                film_id=film.id,
                rank=r.rank,
                score=r.score,
                previous_rank=prev_rank,
                rank_delta=rank_delta,
                score_delta=(
                    round(r.score - prev_score, 1)
                    if prev_score is not None else None
                ),
                ca_score=r.ca_score,
                momentum_score=r.momentum_score,
                recency_score=r.recency_score,
                ae_score=r.ae_score,
                cp_score=r.cp_score,
                signal_volume=r.sample_size or 0,
                confidence=r.confidence,
                source_coverage=coverage.get(film.id, 0),
                sentiment_positive=(sentiment.get(film.id) or (None, None, None))[0],
                sentiment_neutral=(sentiment.get(film.id) or (None, None, None))[1],
                sentiment_negative=(sentiment.get(film.id) or (None, None, None))[2],
                published_at=now,
            ))
        db.flush()
        _validate_daily_snapshot_rows(db, target_date)
        db.commit()
    except SnapshotValidationError as exc:
        db.rollback()
        log.error("publish_daily: post-write validation failed — rolled back — %s", exc)
        return None
    except Exception as exc:
        db.rollback()
        log.error("publish_daily: write failed for %s — %s", target_date, exc)
        return None

    log.info("publish_daily: published %s (%d films)", target_date, len(top))

    # Debuts are part of the same publication event: a film with no prior
    # published rank and no debut record is entering The Index for the first
    # time.  `index_debuts` has a unique constraint per film, so a film can
    # never debut twice even across concurrent runs.
    _record_debuts(db, target_date, top)
    return target_date


def _record_debuts(db: Session, publish_date: date, top: list[tuple[Film, Ranking]]) -> int:
    """Record first-ever appearances for this publication. Idempotent."""
    already_debuted = {
        fid for (fid,) in db.query(IndexDebut.film_id).all()
    }
    prev_ranks = _previous_published_ranks(db, publish_date)
    recorded = 0
    for film, r in top:
        if film.id in already_debuted:
            continue
        if film.id in prev_ranks:
            continue  # appeared on a prior daily index — not a debut
        db.add(IndexDebut(
            film_id=film.id,
            debut_date=publish_date,
            debut_rank=r.rank,
            debut_score=r.score,
            confidence=r.confidence,
            signal_volume=r.sample_size or 0,
            recorded_at=datetime.now(timezone.utc),
        ))
        recorded += 1
    if recorded:
        try:
            db.commit()
            log.info("publish_daily: recorded %d new debuts", recorded)
        except Exception as exc:
            db.rollback()
            log.warning("publish_daily: debut recording failed — %s", exc)
    return recorded


# ── weekly publication ───────────────────────────────────────────────────────

def week_bounds(d: date) -> tuple[date, date]:
    """ISO week bounds (Monday–Sunday) containing `d`."""
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def publish_weekly_index(
    db: Session,
    week_start: date | None = None,
    final_day: date | None = None,
) -> date | None:
    """Publish the official Weekly Index for the week containing `final_day`.

    The weekly score is a genuine weekly aggregate — it is NOT Sunday's daily
    chart renamed.  Per film we aggregate the week's daily signal measurements
    (daily_scores) plus the daily published Index history inside the window:

      weekly composite = 0.40·avg_daily_volume_norm     (sustained attention)
                       + 0.20·days_present/7            (consistency)
                       + 0.15·peak_rank_quality         (chart ceiling)
                       + 0.15·avg_sentiment (0-1)       (audience engagement)
                       + 0.10·source_coverage_norm      (cross-platform)

    then normalises the pool to the 0–100 Index Score scale.  Idempotent per
    week via the unique constraint on (week_start, film_id).

    `week_start` overrides the window (for historical backfill); by default
    the week is derived from `final_day` (default: today).
    """
    if final_day is None:
        final_day = datetime.now(timezone.utc).date()
    if week_start is None:
        week_start, week_end = week_bounds(final_day)
    else:
        week_end = week_start + timedelta(days=6)

    existing = db.query(WeeklyIndexSnapshot.id).filter(
        WeeklyIndexSnapshot.week_start == week_start
    ).first()
    if existing:
        log.info("publish_weekly: week of %s already published — skipping", week_start)
        return None

    week_start_dt = datetime(week_start.year, week_start.month, week_start.day)
    week_end_exclusive = datetime.combine(week_end + timedelta(days=1), datetime.min.time())

    # ── per-film daily signal measurements inside the window ─────────────────
    ds_rows = (
        db.query(
            DailyScore.film_id,
            func.count(DailyScore.day),
            func.sum(DailyScore.mentions_count),
            func.avg(DailyScore.sentiment_avg),
        )
        .filter(DailyScore.day >= week_start, DailyScore.day <= week_end)
        .group_by(DailyScore.film_id)
        .all()
    )
    days_present: dict[int, int] = {}
    total_mentions: dict[int, int] = {}
    avg_sentiment: dict[int, float] = {}
    for fid, days, mentions, savg in ds_rows:
        days_present[fid] = int(days or 0)
        total_mentions[fid] = int(mentions or 0)
        avg_sentiment[fid] = float(savg or 0.0)

    # Real-time backstop: daily_scores lag the rollup worker, so fill the same
    # aggregates directly from mentions when the rollup has not run.  Catalog-
    # only sources are excluded — TMDB rows are not weekly signal volume.
    catalog_ids = _catalog_source_ids(db)
    m_rows_q = (
        db.query(
            Mention.film_id,
            func.count(func.distinct(func.date(Mention.created_at))),
            func.count(Mention.id),
            func.avg(Mention.sentiment_score),
        )
        .filter(Mention.created_at >= week_start_dt, Mention.created_at < week_end_exclusive)
    )
    if catalog_ids:
        m_rows_q = m_rows_q.filter(~Mention.source_id.in_(catalog_ids))
    m_rows = m_rows_q.group_by(Mention.film_id).all()
    for fid, days, mentions, savg in m_rows:
        days_present[fid] = max(days_present.get(fid, 0), int(days or 0))
        total_mentions[fid] = max(total_mentions.get(fid, 0), int(mentions or 0))
        avg_sentiment[fid] = float(savg or 0.0)

    if not total_mentions:
        log.warning("publish_weekly: no signal data in week %s..%s", week_start, week_end)
        return None

    # ── published daily history inside the window (chart presence) ───────────
    daily_rows = (
        db.query(
            DailyIndexSnapshot.film_id,
            func.count(DailyIndexSnapshot.id),
            func.min(DailyIndexSnapshot.rank),
            func.avg(DailyIndexSnapshot.score),
        )
        .filter(
            DailyIndexSnapshot.snapshot_date >= week_start,
            DailyIndexSnapshot.snapshot_date <= week_end,
        )
        .group_by(DailyIndexSnapshot.film_id)
        .all()
    )
    chart_days: dict[int, int] = {}
    peak_rank: dict[int, int] = {}
    avg_daily_score: dict[int, float] = {}
    for fid, days, peak, avg_score in daily_rows:
        chart_days[fid] = int(days or 0)
        peak_rank[fid] = int(peak or 999)
        avg_daily_score[fid] = float(avg_score or 0.0)

    candidate_ids = set(total_mentions.keys()) | set(chart_days.keys())
    if not candidate_ids:
        return None

    coverage = _source_coverage(db, list(candidate_ids))

    # ── raw weekly components (higher = stronger week) ───────────────────────
    vol_raw = {fid: float(total_mentions.get(fid, 0)) for fid in candidate_ids}
    consist_raw = {fid: min(chart_days.get(fid, 0) or days_present.get(fid, 0), 7) / 7.0
                   for fid in candidate_ids}
    peak_quality = {
        fid: 1.0 - min(peak_rank.get(fid, 101), 100) / 100.0 for fid in candidate_ids
    }
    sentiment_raw = {fid: (avg_sentiment.get(fid, 0.0) + 1.0) / 2.0 for fid in candidate_ids}
    coverage_raw = {fid: min(coverage.get(fid, 0), 7) / 7.0 for fid in candidate_ids}

    def _minmax(values: dict[int, float]) -> dict[int, float]:
        lo = min(values.values(), default=0.0)
        hi = max(values.values(), default=0.0)
        if hi <= lo:
            return {fid: 0.5 for fid in values}
        return {fid: (v - lo) / (hi - lo) for fid, v in values.items()}

    vol_n = _minmax(vol_raw)
    cov_n = _minmax(coverage_raw)

    WEIGHTS = dict(vol=0.40, consist=0.20, peak=0.15, sentiment=0.15, coverage=0.10)
    composite = {
        fid: (
            WEIGHTS["vol"] * vol_n[fid]
            + WEIGHTS["consist"] * consist_raw[fid]
            + WEIGHTS["peak"] * peak_quality[fid]
            + WEIGHTS["sentiment"] * sentiment_raw[fid]
            + WEIGHTS["coverage"] * cov_n[fid]
        )
        for fid in candidate_ids
    }
    max_c = max(composite.values()) or 1.0
    scored = sorted(
        ((fid, round(s * 98.5 / max_c, 1)) for fid, s in composite.items()),
        key=lambda x: (-x[1], x[0]),
    )
    top = scored[:CHART_SIZE]

    # Evidence tiers mirror the daily engine (absolute floor on signal volume)
    from app.services.confidence import confidence_tier
    confidences = {fid: confidence_tier(total_mentions.get(fid, 0)) for fid, _ in top}

    prev_week_ranks: dict[int, int] = {}
    prev_week = week_start - timedelta(days=7)
    for fid, rank in db.query(
        WeeklyIndexSnapshot.film_id, WeeklyIndexSnapshot.rank
    ).filter(WeeklyIndexSnapshot.week_start == prev_week).all():
        prev_week_ranks[fid] = rank

    now = datetime.now(timezone.utc)
    for rank_i, (fid, score) in enumerate(top, start=1):
        prev = prev_week_ranks.get(fid)
        db.add(WeeklyIndexSnapshot(
            week_start=week_start,
            week_end=week_end,
            film_id=fid,
            rank=rank_i,
            score=score,
            previous_week_rank=prev,
            rank_delta=(prev - rank_i) if prev is not None else 0,
            avg_daily_mentions=round(total_mentions.get(fid, 0) / 7.0, 2),
            total_signal_volume=total_mentions.get(fid, 0),
            avg_sentiment=avg_sentiment.get(fid),
            peak_daily_rank=peak_rank.get(fid),
            source_coverage=coverage.get(fid, 0),
            confidence=confidences[fid],
            published_at=now,
        ))

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        log.error("publish_weekly: write failed for %s — %s", week_start, exc)
        return None
    log.info("publish_weekly: published week of %s (%d films)", week_start, len(top))
    return week_start


# ── derived products ─────────────────────────────────────────────────────────

@dataclass
class MoverRow:
    film_id: int
    slug: str
    title: str
    poster_url: str | None
    direction: str          # "up" | "down"
    movement: int           # absolute rank positions gained/lost
    previous_rank: int | None
    current_rank: int
    current_score: float
    previous_score: float | None
    score_delta: float | None
    confidence: str | None


def biggest_movers(db: Session, limit: int = 10) -> dict[str, list[MoverRow]]:
    """Biggest gainers/decliners from the two most recent published dailies.

    Movement is RANK-based (never score-based); score delta is reported
    separately.  Films whose rank did not change are excluded by definition.
    """
    dates = [
        d for (d,) in db.query(DailyIndexSnapshot.snapshot_date)
        .distinct().order_by(DailyIndexSnapshot.snapshot_date.desc()).limit(2).all()
    ]
    if not dates:
        return {"gainers": [], "decliners": []}

    latest_date = dates[0]
    prior_date = dates[1] if len(dates) > 1 else None

    latest = db.query(DailyIndexSnapshot).filter(
        DailyIndexSnapshot.snapshot_date == latest_date
    ).all()
    by_film_latest = {r.film_id: r for r in latest}

    prior: dict[int, DailyIndexSnapshot] = {}
    if prior_date is not None:
        for r in db.query(DailyIndexSnapshot).filter(
            DailyIndexSnapshot.snapshot_date == prior_date
        ).all():
            prior[r.film_id] = r

    # Movers are computed against the previous PUBLISHED daily, not just the
    # immediately-prior snapshot date — using the last rank each film held
    # keeps movement correct across skipped publication days.
    latest_published_before = db.query(
        DailyIndexSnapshot.film_id,
        DailyIndexSnapshot.rank,
        DailyIndexSnapshot.score,
        func.max(DailyIndexSnapshot.snapshot_date),
    ).filter(
        DailyIndexSnapshot.snapshot_date < latest_date
    ).group_by(DailyIndexSnapshot.film_id).all()
    by_film_prior = {fid: (rank, score) for fid, rank, score, _ in latest_published_before}
    if prior_date is None:
        by_film_prior = {
            fid: (rank, score) for fid, (rank, score) in by_film_prior.items()
        }

    film_ids = list(by_film_latest.keys())
    films = {
        f.id: f for f in db.query(Film).filter(Film.id.in_(film_ids)).all()
    }

    gainers: list[MoverRow] = []
    decliners: list[MoverRow] = []
    for fid, cur in by_film_latest.items():
        prev_entry = by_film_prior.get(fid)
        if prev_entry is None:
            continue  # debuts are New Entries, not movers
        prev_rank, prev_score = prev_entry
        delta = prev_rank - cur.rank  # positive = moved up
        if delta == 0:
            continue
        film = films.get(fid)
        if film is None:
            continue
        row = MoverRow(
            film_id=fid,
            slug=film.slug,
            title=film.title,
            poster_url=film.poster_url,
            direction="up" if delta > 0 else "down",
            movement=abs(delta),
            previous_rank=prev_rank,
            current_rank=cur.rank,
            current_score=cur.score,
            previous_score=prev_score,
            score_delta=(
                round(cur.score - prev_score, 1) if prev_score is not None else None
            ),
            confidence=cur.confidence,
        )
        (gainers if delta > 0 else decliners).append(row)

    gainers.sort(key=lambda r: -r.movement)
    decliners.sort(key=lambda r: -r.movement)
    return {"gainers": gainers[:limit], "decliners": decliners[:limit]}


def new_entries(db: Session, limit: int = 20, days: int | None = None) -> list[IndexDebut]:
    """Films entering The Index for the first time (their only appearance as new).

    A film debuts exactly once — `index_debuts` enforces it.  `days` optionally
    restricts to debuts within the last N days; results are ordered newest
    debut first, then by debut rank.
    """
    q = (
        db.query(IndexDebut, Film)
        .join(Film, Film.id == IndexDebut.film_id)
        .order_by(IndexDebut.debut_date.desc(), IndexDebut.debut_rank.asc())
    )
    if days is not None:
        cutoff = date.today() - timedelta(days=days)
        q = q.filter(IndexDebut.debut_date >= cutoff)
    return q.limit(limit).all()
