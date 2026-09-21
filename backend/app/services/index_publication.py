"""Official Index publication layer — daily/weekly snapshots, movers, debuts.

Separation of concerns (the architectural rule this module enforces):

  continuous computation  — `rankings` table, recomputed every refresh cycle
                            by app.services.ranking.recompute_rankings. Never
                            shown as "the official chart".
  official publication    — `daily_index_snapshots`, written once per day per
                            official chart (Movie 100, TV 100) from the latest
                            computed snapshot (with validation).
  weekly publication      — `weekly_index_snapshots`, once per ISO week per
                            chart, aggregated from daily signal measurements
                            over the week window (NOT a copy of any daily
                            chart).
  derived products        — Biggest Movers (rank deltas between published
                            dailies of the SAME chart) and New Entries
                            (first appearances per chart, enforced unique by
                            `index_debuts`).

Chart law this module enforces:
  * A public rank ONLY exists between #1 and #100 — the publication writes at
    most CHART_SIZE rows per chart; internal candidate positions beyond that
    are never persisted, so "#153" can never surface as a rank.
  * Rank is ALWAYS contextual to a chart.  Movement is never computed across
    chart types; every historical row carries its chart_id.
  * Movies never hold TV 100 positions; TV shows never hold Movie 100 ones.

All publish functions are idempotent: unique constraints + existence checks
make re-running on the same date/week a no-op.  Validation runs BEFORE any
write; a failed validation leaves the previous valid snapshot untouched.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, tuple_
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
from app.config import settings
from app.services.confidence import CATALOG_ONLY_SOURCE_KEYS

log = logging.getLogger(__name__)

CHART_SIZE = 100

# Official chart identifiers (mirror app.models.snapshots / ranking engine).
MOVIE_100 = "MOVIE_100"
TV_100 = "TV_100"
# The combined Weekly Top 100: movies AND TV shows on one chart, measured
# across the full ISO week.  Rank is contextual to this chart too; every row
# carries the title's content_type so clients can label Movie vs TV.
WEEKLY_100 = "WEEKLY_100"
OFFICIAL_CHARTS: tuple[tuple[str, str], ...] = (
    (MOVIE_100, "MOVIE"),
    (TV_100, "TV_SHOW"),
)
VALID_CHART_TYPES = frozenset({c for c, _ in OFFICIAL_CHARTS} | {WEEKLY_100})


def normalize_chart(chart: str | None) -> str | None:
    """Coerce a client-supplied chart slug to a canonical chart id.

    Accepts MOVIE_100 / TV_100 (case-insensitive, dashes/underscores both).
    Returns None for unknown values — the caller decides whether that is a
    404 or a default-to-Movie-100.
    """
    if not chart:
        return MOVIE_100
    key = chart.strip().upper().replace("-", "_")
    if key in VALID_CHART_TYPES:
        return key
    if key in ("MOVIE", "MOVIES"):
        return MOVIE_100
    if key in ("TV", "TV_SHOW", "TV_SHOWS", "SHOWS"):
        return TV_100
    if key in ("WEEKLY", "WEEK"):
        return WEEKLY_100
    return None


class SnapshotValidationError(Exception):
    """Raised when a candidate ranking fails publication validation."""


# ── validation ───────────────────────────────────────────────────────────────

def _validate_ranking_rows(
    rows: list[tuple[Film, Ranking]], chart_type: str | None = None
) -> None:
    """Validate a candidate (film, ranking) list before publishing.

    Checks the full data-integrity contract; raises SnapshotValidationError
    with a specific reason on the first violation.  The caller must NOT write
    anything when this raises.  When `chart_type` is given, also enforces the
    chart/entity-type contract: only MOVIE titles may sit on MOVIE_100 and
    only TV_SHOW titles on TV_100.
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

        if chart_type is not None:
            ct = (film.content_type or "MOVIE").upper()
            expected = "MOVIE" if chart_type == MOVIE_100 else "TV_SHOW"
            if ct != expected:
                raise SnapshotValidationError(
                    f"chart/entity mismatch: {ct} {film.slug!r} cannot hold a {chart_type} position"
                )


def _validate_daily_snapshot_rows(
    db: Session, snapshot_date: date, chart_type: str = MOVIE_100
) -> None:
    """Post-write integrity check on what actually landed in the DB."""
    rows = db.query(DailyIndexSnapshot).filter(
        DailyIndexSnapshot.snapshot_date == snapshot_date,
        DailyIndexSnapshot.chart_type == chart_type,
    ).order_by(DailyIndexSnapshot.rank).all()
    ranks = [r.rank for r in rows]
    if len(ranks) != len(set(ranks)):
        raise SnapshotValidationError("published rows contain duplicate ranks")
    if ranks != list(range(1, len(ranks) + 1)):
        raise SnapshotValidationError(f"published ranks not sequential: {ranks[:10]}…")
    if any(r < 1 or r > CHART_SIZE for r in ranks):
        raise SnapshotValidationError("published rank outside 1..100")
    film_ids = {r.film_id for r in rows}
    existing = {
        fid for (fid,) in db.query(Film.id).filter(Film.id.in_(film_ids)).all()
    }
    missing = film_ids - existing
    if missing:
        raise SnapshotValidationError(f"published rows reference missing films: {sorted(missing)[:5]}")
    # Chart/entity-type contract: every published row must match its chart.
    expected_ct = "MOVIE" if chart_type == MOVIE_100 else "TV_SHOW"
    ct_map = {
        f.id: (f.content_type or "MOVIE").upper()
        for f in db.query(Film).filter(Film.id.in_(film_ids)).all()
    }
    for r in rows:
        if ct_map.get(r.film_id) != expected_ct:
            raise SnapshotValidationError(
                f"published {chart_type} row {r.rank} has wrong entity type {ct_map.get(r.film_id)!r}"
            )


# ── helpers ──────────────────────────────────────────────────────────────────

def _latest_continuous_ranking(
    db: Session, chart_type: str | None = None
) -> list[tuple[Film, Ranking]]:
    """The freshest rows from the continuous computation layer, optionally
    restricted to one official chart."""
    snap = db.scalar(select(func.max(Ranking.snapshot_at)))
    if snap is None:
        return []
    q = (
        db.query(Film, Ranking)
        .join(Ranking, Ranking.film_id == Film.id)
        .filter(Ranking.snapshot_at == snap)
    )
    if chart_type is not None:
        q = q.filter(Ranking.chart_type == chart_type)
    return q.order_by(Ranking.rank.asc()).all()


def _previous_published_ranks(
    db: Session, before_date: date, chart_type: str = MOVIE_100
) -> dict[int, int]:
    """Most recent published daily rank per film strictly before `before_date`,
    within one chart.  Movement is NEVER computed across chart types."""
    rows = db.query(
        DailyIndexSnapshot.film_id,
        DailyIndexSnapshot.rank,
    ).filter(
        DailyIndexSnapshot.snapshot_date < before_date,
        DailyIndexSnapshot.chart_type == chart_type,
    ).all()
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
    """Publish the official daily charts for `publish_date` (default: today UTC).

    Publishes ONE immutable snapshot per official chart — Movie 100 and
    TV 100 — from the latest continuous computation.  Ranks beyond position
    100 are never persisted: a public rank only exists between #1 and #100.

    Idempotent per (chart, date): an already-published chart is skipped.
    Validates before writing; on post-write failure the transaction is rolled
    back so the previous valid snapshot survives.

    Returns the publication date if at least one chart was newly published,
    None otherwise.
    """
    target_date = publish_date or datetime.now(timezone.utc).date()

    published_any = False
    for chart_id, _entity_ct in OFFICIAL_CHARTS:
        existing = db.query(DailyIndexSnapshot.id).filter(
            DailyIndexSnapshot.snapshot_date == target_date,
            DailyIndexSnapshot.chart_type == chart_id,
        ).first()
        if existing:
            log.info("publish_daily: %s %s already published — skipping", chart_id, target_date)
            continue

        ranked = _latest_continuous_ranking(db, chart_type=chart_id)
        if not ranked:
            log.warning("publish_daily: no continuous ranking for %s — skipping", chart_id)
            continue

        top = [(f, r) for f, r in ranked[:CHART_SIZE]]
        try:
            _validate_ranking_rows(top, chart_type=chart_id)
        except SnapshotValidationError as exc:
            # Do not publish corrupted rankings — keep the previous valid snapshot.
            log.error("publish_daily: validation FAILED for %s %s — %s", chart_id, target_date, exc)
            continue

        now = datetime.now(timezone.utc)
        prev_ranks = _previous_published_ranks(db, target_date, chart_type=chart_id)
        prev_scores = {
            fid: score
            for fid, score in db.query(
                DailyIndexSnapshot.film_id, DailyIndexSnapshot.score
            ).filter(
                DailyIndexSnapshot.snapshot_date < target_date,
                DailyIndexSnapshot.chart_type == chart_id,
            ).all()
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
                    chart_type=chart_id,
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
            _validate_daily_snapshot_rows(db, target_date, chart_type=chart_id)
            db.commit()
        except SnapshotValidationError as exc:
            db.rollback()
            log.error("publish_daily: post-write validation failed for %s — rolled back — %s", chart_id, exc)
            continue
        except Exception as exc:
            db.rollback()
            log.error("publish_daily: write failed for %s %s — %s", chart_id, target_date, exc)
            continue

        log.info("publish_daily: published %s %s (%d titles)", chart_id, target_date, len(top))
        published_any = True

        # Debuts are part of the same publication event: a title with no prior
        # published rank on THIS chart and no debut record is entering that
        # chart for the first time.  NEW is always chart-scoped.
        _record_debuts(db, target_date, top, chart_type=chart_id)

    return target_date if published_any else None


def _record_debuts(
    db: Session,
    publish_date: date,
    top: list[tuple[Film, Ranking]],
    chart_type: str = MOVIE_100,
) -> int:
    """Record first-ever appearances on one chart for this publication. Idempotent."""
    already_debuted = {
        fid for (fid,) in db.query(IndexDebut.film_id)
        .filter(IndexDebut.chart_type == chart_type).all()
    }
    prev_ranks = _previous_published_ranks(db, publish_date, chart_type=chart_type)
    recorded = 0
    for film, r in top:
        if film.id in already_debuted:
            continue
        if film.id in prev_ranks:
            continue  # appeared on a prior publication of this chart — not a debut
        db.add(IndexDebut(
            chart_type=chart_type,
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
            log.info("publish_daily: recorded %d new %s debuts", recorded, chart_type)
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


def _absolute_scores(attention: dict[int, float]) -> dict[int, float]:
    """Map absolute attention intensities onto the universal 0–100 Index
    Score scale — the SAME map the daily engine uses (see
    app.services.ranking): 100·log10(1+A)/log10(1+A_ref), clamped to 100.

    Never rank-derived and never pool-relative: the same measured attention
    produces the same score in any week, so weekly numbers stay comparable
    across the archive.
    """
    a_ref = max(settings.score_attention_ref, 1e-6)
    denom = math.log10(1.0 + a_ref)

    def _one(a: float) -> float:
        if a <= 0.0:
            return 0.0
        return max(0.0, min(100.0, 100.0 * math.log10(1.0 + a) / denom))

    return {fid: _one(a) for fid, a in attention.items()}


def publish_weekly_index(
    db: Session,
    week_start: date | None = None,
    final_day: date | None = None,
) -> date | None:
    """Publish the official Weekly charts for the week containing `final_day`.

    Publishes THREE weekly charts from the same week-window aggregates:

      MOVIE_100   weekly — movies only
      TV_100      weekly — TV shows only
      WEEKLY_100  the combined Weekly Top 100 — movies AND TV on one chart,
                  every row labeled by the title's content_type

    The weekly score is a genuine weekly aggregate — it is NOT Sunday's daily
    chart renamed, and NOT the final ranking of the week.  Per title we
    aggregate the week's daily signal measurements (daily_scores, with a
    direct-mentions backstop) plus the published daily chart history inside
    the window:

      weekly composite = 0.40·log-volume_norm       (sustained attention)
                       + 0.25·days_ranked/7         (consistency)
                       + 0.20·mean_daily_rank_quality  (spike punisher)
                       + 0.10·avg_sentiment (0-1)   (audience engagement)
                       + 0.05·source_coverage_norm  (cross-platform)

    Mean DAILY rank quality (not the weekly peak) is what makes a title that
    sits near the top all week beat a title that touches #1 once and falls
    out.  The composite maps onto the universal 0–100 Index Score through the
    same ABSOLUTE attention map the daily engine uses
    (100·log10(1+A)/log10(1+A_ref), A = avg decayed mentions/day in the
    window) — never rank-derived.

    Archive rule: a COMPLETED week's rows are immutable (re-publish is a
    no-op) so historical archives accumulate forever.  The CURRENT week
    refreshes in place on each run, so mid-week the chart shows the week so
    far.  Idempotent per (chart, week) for completed weeks.

    `week_start` overrides the window (for historical backfill); by default
    the week is derived from `final_day` (default: today).
    """
    if final_day is None:
        final_day = datetime.now(timezone.utc).date()
    if week_start is None:
        week_start, week_end = week_bounds(final_day)
    else:
        week_end = week_start + timedelta(days=6)

    week_start_dt = datetime(week_start.year, week_start.month, week_start.day)
    week_end_exclusive = datetime.combine(week_end + timedelta(days=1), datetime.min.time())
    now = datetime.now(timezone.utc)
    # A completed week is an immutable archive; the CURRENT week refreshes in
    # place so mid-week the chart shows the week so far.
    is_completed_week = week_end < now.date()

    # ── per-title week-window aggregates, loaded ONCE for all three charts ──
    # NOT scoped by entity type here: the combined WEEKLY_100 pool spans both.
    # Chart scoping happens per scope below.
    catalog_ids = _catalog_source_ids(db)

    days_present: dict[int, int] = {}
    total_mentions: dict[int, int] = {}
    avg_sentiment: dict[int, float] = {}
    mention_days: dict[int, set[date]] = {}

    # Rolled-up daily scores (primary source)
    ds_rows = (
        db.query(
            DailyScore.film_id,
            func.count(DailyScore.day),
            func.sum(DailyScore.mentions_count),
            func.avg(DailyScore.sentiment_avg),
        )
        .filter(
            DailyScore.day >= week_start,
            DailyScore.day <= week_end,
        )
        .group_by(DailyScore.film_id)
        .all()
    )
    for fid, days, mentions, savg in ds_rows:
        days_present[fid] = int(days or 0)
        total_mentions[fid] = int(mentions or 0)
        avg_sentiment[fid] = float(savg or 0.0)

    # Real-time backstop: daily_scores lag the rollup worker, so take the max
    # of the same aggregates straight from mentions.  Catalog-only sources are
    # excluded — TMDB rows are not weekly signal volume.
    m_rows_q = (
        db.query(
            Mention.film_id,
            func.count(func.distinct(func.date(Mention.created_at))),
            func.count(Mention.id),
            func.avg(Mention.sentiment_score),
        )
        .filter(
            Mention.created_at >= week_start_dt,
            Mention.created_at < week_end_exclusive,
        )
        .group_by(Mention.film_id)
    )
    if catalog_ids:
        m_rows_q = m_rows_q.filter(~Mention.source_id.in_(catalog_ids))
    m_days_q = (
        db.query(
            Mention.film_id,
            func.date(Mention.created_at),
        )
        .filter(
            Mention.created_at >= week_start_dt,
            Mention.created_at < week_end_exclusive,
        )
        .group_by(Mention.film_id, func.date(Mention.created_at))
    )
    if catalog_ids:
        m_days_q = m_days_q.filter(~Mention.source_id.in_(catalog_ids))
    mention_days = {}
    for fid, day_val in m_days_q.all():
        d = day_val if isinstance(day_val, date) else date.fromisoformat(str(day_val))
        mention_days.setdefault(fid, set()).add(d)
    for fid, days, mentions, savg in m_rows_q.all():
        days_present[fid] = max(days_present.get(fid, 0), int(days or 0))
        total_mentions[fid] = max(total_mentions.get(fid, 0), int(mentions or 0))
        avg_sentiment[fid] = float(savg or 0.0)


    # Published daily chart history inside the window, per daily chart — the
    # consistency/rank-quality inputs (WEEKLY_100 pools both daily charts).
    def _daily_history(hist_chart: str) -> tuple[dict[int, int], dict[int, int], dict[int, float]]:
        rows = (
            db.query(
                DailyIndexSnapshot.film_id,
                func.count(DailyIndexSnapshot.id),
                func.min(DailyIndexSnapshot.rank),
                func.avg(DailyIndexSnapshot.rank),
            )
            .filter(
                DailyIndexSnapshot.snapshot_date >= week_start,
                DailyIndexSnapshot.snapshot_date <= week_end,
                DailyIndexSnapshot.chart_type == hist_chart,
            )
            .group_by(DailyIndexSnapshot.film_id)
            .all()
        )
        days_map: dict[int, int] = {}
        peak_map: dict[int, int] = {}
        avg_rank_map: dict[int, float] = {}
        for fid, days, peak, avg_r in rows:
            days_map[fid] = int(days or 0)
            peak_map[fid] = int(peak or 999)
            avg_rank_map[fid] = float(avg_r if avg_r is not None else (peak or 999))
        return days_map, peak_map, avg_rank_map

    movie_hist = _daily_history(MOVIE_100)
    tv_hist = _daily_history(TV_100)
    if not total_mentions and not (movie_hist[0] or tv_hist[0]):
        log.warning("publish_weekly: no signal data in week %s..%s", week_start, week_end)
        return None

    content_type_map = {
        fid: (ct or "MOVIE").upper()
        for fid, ct in db.query(Film.id, Film.content_type).all()
    }

    published_any = False
    for chart_id, entity_ct, hist in (
        (MOVIE_100, "MOVIE", movie_hist),
        (TV_100, "TV_SHOW", tv_hist),
        (WEEKLY_100, None, None),  # combined — pools both daily charts
    ):
        # Completed weeks are immutable archives (re-publish is a no-op);
        # the current week refreshes in place.
        existing = db.query(WeeklyIndexSnapshot.id).filter(
            WeeklyIndexSnapshot.week_start == week_start,
            WeeklyIndexSnapshot.chart_type == chart_id,
        ).first()
        if existing and is_completed_week:
            log.info("publish_weekly: %s week of %s already archived — skipping", chart_id, week_start)
            continue
        if existing:
            db.query(WeeklyIndexSnapshot).filter(
                WeeklyIndexSnapshot.week_start == week_start,
                WeeklyIndexSnapshot.chart_type == chart_id,
            ).delete(synchronize_session=False)

        # ── scope the aggregates to this chart ───────────────────────────
        def _scoped(pool: dict[int, float]) -> dict[int, float]:
            if entity_ct is None:
                return dict(pool)
            return {
                fid: v for fid, v in pool.items()
                if content_type_map.get(fid) == entity_ct
            }

        scope_days_present = _scoped({fid: float(v) for fid, v in days_present.items()})
        scope_total_mentions = _scoped({fid: float(v) for fid, v in total_mentions.items()})
        scope_sentiment = _scoped(avg_sentiment)
        scope_mention_days = {
            fid: days for fid, days in mention_days.items()
            if entity_ct is None or content_type_map.get(fid) == entity_ct
        }
        if hist is not None:
            scope_chart_days, scope_peak, scope_avg_rank = hist
        else:
            # Combined chart: merge both daily histories.  A title holds a
            # rank on exactly one of them, so days add and avg rank joins.
            scope_chart_days = {**movie_hist[0], **tv_hist[0]}
            scope_peak = {**movie_hist[1], **tv_hist[1]}
            scope_avg_rank = {**movie_hist[2], **tv_hist[2]}

        candidate_ids = set(scope_total_mentions.keys()) | set(scope_chart_days.keys())
        if not candidate_ids:
            log.info("publish_weekly: no %s candidates in week %s..%s", chart_id, week_start, week_end)
            continue

        coverage = _source_coverage(db, list(candidate_ids))

        # ── raw weekly components (higher = stronger week) ───────────────
        vol_raw = {fid: float(scope_total_mentions.get(fid, 0)) for fid in candidate_ids}
        # Consistency: share of the 7 days the title was RANKED on its daily
        # chart (mention-days as fallback for titles without published
        # dailies yet — early-beta coverage).
        consist_raw = {
            fid: min(scope_chart_days.get(fid, 0) or len(scope_mention_days.get(fid, set())), 7) / 7.0
            for fid in candidate_ids
        }
        # Mean DAILY rank quality — averaging every ranked day (not the peak)
        # is the spike punisher: top-5 all week ≈ 0.94, while a single #1 day
        # followed by fall-out collapses toward ~0.1.
        rank_quality = {
            fid: 1.0 - min((scope_avg_rank.get(fid, 101.0) - 1.0) / 99.0, 1.0)
            for fid in candidate_ids
        }
        sentiment_raw = {fid: (scope_sentiment.get(fid, 0.0) + 1.0) / 2.0 for fid in candidate_ids}
        coverage_raw = {fid: min(coverage.get(fid, 0), 7) / 7.0 for fid in candidate_ids}

        def _minmax(values: dict[int, float]) -> dict[int, float]:
            lo = min(values.values(), default=0.0)
            hi = max(values.values(), default=0.0)
            if hi <= lo:
                return {fid: 0.5 for fid in values}
            return {fid: (v - lo) / (hi - lo) for fid, v in values.items()}

        vol_n = _minmax(vol_raw)
        cov_n = _minmax(coverage_raw)

        WEIGHTS = dict(vol=0.40, consist=0.25, quality=0.20, sentiment=0.10, coverage=0.05)
        composite = {
            fid: (
                WEIGHTS["vol"] * vol_n[fid]
                + WEIGHTS["consist"] * consist_raw[fid]
                + WEIGHTS["quality"] * rank_quality[fid]
                + WEIGHTS["sentiment"] * sentiment_raw[fid]
                + WEIGHTS["coverage"] * cov_n[fid]
            )
            for fid in candidate_ids
        }
        # Ordering is the weekly composite (sustained performance across the
        # whole week), NOT the displayed score: rank measures position within
        # the week's pool, the score measures absolute attention.
        ordered = sorted(candidate_ids, key=lambda fid: (-composite[fid], fid))[:CHART_SIZE]
        if not ordered:
            continue

        # Displayed score = the same ABSOLUTE attention map as the daily
        # engine, fed by the week's own attention intensity: average
        # mentions/day across the window (same units as the daily map's A,
        # flat-averaged over the week instead of λ-decayed from today).
        scores = _absolute_scores({
            fid: scope_total_mentions.get(fid, 0.0) / 7.0 for fid in ordered
        })

        # Evidence tiers mirror the daily engine (absolute floor on signal volume)
        from app.services.confidence import confidence_tier
        confidences = {
            fid: confidence_tier(int(scope_total_mentions.get(fid, 0)))
            for fid in ordered
        }

        prev_week_ranks: dict[int, int] = {}
        prev_week = week_start - timedelta(days=7)
        for fid, rank in db.query(
            WeeklyIndexSnapshot.film_id, WeeklyIndexSnapshot.rank
        ).filter(
            WeeklyIndexSnapshot.week_start == prev_week,
            WeeklyIndexSnapshot.chart_type == chart_id,
        ).all():
            prev_week_ranks[fid] = rank

        for rank_i, fid in enumerate(ordered, start=1):
            prev = prev_week_ranks.get(fid)
            mentions_week = int(scope_total_mentions.get(fid, 0))
            db.add(WeeklyIndexSnapshot(
                week_start=week_start,
                week_end=week_end,
                chart_type=chart_id,
                film_id=fid,
                rank=rank_i,
                score=round(scores[fid], 1),
                previous_week_rank=prev,
                rank_delta=(prev - rank_i) if prev is not None else 0,
                avg_daily_mentions=round(mentions_week / 7.0, 2),
                total_signal_volume=mentions_week,
                avg_sentiment=scope_sentiment.get(fid),
                peak_daily_rank=scope_peak.get(fid),
                source_coverage=coverage.get(fid, 0),
                confidence=confidences[fid],
                published_at=now,
            ))

        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            log.error("publish_weekly: write failed for %s %s — %s", chart_id, week_start, exc)
            continue
        log.info("publish_weekly: published %s week of %s (%d titles)", chart_id, week_start, len(ordered))
        published_any = True

    return week_start if published_any else None


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


def biggest_movers(
    db: Session, limit: int = 10, chart_type: str = MOVIE_100
) -> dict[str, list[MoverRow]]:
    """Biggest gainers/decliners from the two most recent published dailies of
    ONE chart.  Movement is RANK-based (never score-based), computed strictly
    within the chart — never across chart types.  Titles whose rank did not
    change are excluded by definition; debuts are New Entries, not movers.
    """
    dates = [
        d for (d,) in db.query(DailyIndexSnapshot.snapshot_date)
        .filter(DailyIndexSnapshot.chart_type == chart_type)
        .distinct().order_by(DailyIndexSnapshot.snapshot_date.desc()).limit(2).all()
    ]
    if not dates:
        return {"gainers": [], "decliners": []}

    latest_date = dates[0]

    latest = db.query(DailyIndexSnapshot).filter(
        DailyIndexSnapshot.snapshot_date == latest_date,
        DailyIndexSnapshot.chart_type == chart_type,
    ).all()
    by_film_latest = {r.film_id: r for r in latest}

    # Movers are computed against the previous PUBLISHED daily of the same
    # chart, not just the immediately-prior snapshot date — using the last
    # rank each title held keeps movement correct across skipped publication
    # days.  Two-step (max date per film, then fetch those rows): selecting
    # bare rank/score next to an aggregate would violate MySQL 8's default
    # ONLY_FULL_GROUP_BY mode and 500 in production.
    max_dates = dict(
        db.query(
            DailyIndexSnapshot.film_id,
            func.max(DailyIndexSnapshot.snapshot_date),
        )
        .filter(
            DailyIndexSnapshot.snapshot_date < latest_date,
            DailyIndexSnapshot.chart_type == chart_type,
        )
        .group_by(DailyIndexSnapshot.film_id)
        .all()
    )
    by_film_prior: dict[int, tuple[int, float]] = {}
    if max_dates:
        prior_rows = (
            db.query(
                DailyIndexSnapshot.film_id,
                DailyIndexSnapshot.rank,
                DailyIndexSnapshot.score,
            )
            .filter(
                tuple_(DailyIndexSnapshot.film_id, DailyIndexSnapshot.snapshot_date).in_(
                    list(max_dates.items())
                ),
                DailyIndexSnapshot.chart_type == chart_type,
            )
            .all()
        )
        by_film_prior = {fid: (rank, score) for fid, rank, score in prior_rows}

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


def new_entries(
    db: Session,
    limit: int = 20,
    days: int | None = None,
    chart_type: str = MOVIE_100,
) -> list[tuple[IndexDebut, Film]]:
    """Titles entering ONE chart for the first time (their only appearance as
    NEW on that chart).

    A title debuts exactly once per chart — `index_debuts` (chart_type,
    film_id) enforces it.  NEW means first entry into the official chart;
    release date plays no part in the definition.  `days` optionally
    restricts to debuts within the last N days; results are ordered newest
    debut first, then by debut rank.
    """
    q = (
        db.query(IndexDebut, Film)
        .join(Film, Film.id == IndexDebut.film_id)
        .filter(IndexDebut.chart_type == chart_type)
        .order_by(IndexDebut.debut_date.desc(), IndexDebut.debut_rank.asc())
    )
    if days is not None:
        cutoff = date.today() - timedelta(days=days)
        q = q.filter(IndexDebut.debut_date >= cutoff)
    return q.limit(limit).all()
