"""Ranking engine — five-component windowed scoring model.

FinalScore = 0.30·CA_norm + 0.25·M_norm + 0.20·R_raw + 0.15·AE_norm + 0.10·CP_norm

No component ever sums over the full lifetime of a film's history.  Every
input is time-windowed, EWMA-weighted, or a bounded linear function of age.
This means a newly released film is never structurally disadvantaged versus
one that has been tracked for months.

Component overview
──────────────────
CA  Current Attention (30%)  — recency-weighted log-mention average over the
    last W days, normalised by actual days tracked (not a fixed window), so
    a 3-day-old film is not penalised for lacking history.

M   Momentum (25%)           — EWMA_short − EWMA_long on the same log-mention
    series.  Absolute delta, never a growth-rate, so divide-by-zero is
    impossible for films in their first few days.

R   Recency (20%)            — linear decay from 1.0 on day 0 to 0.0 on day 21.
    Zero for every title after day 21 — no permanent age-based advantage.

AE  Audience Engagement (15%)— 14-day EWMA of daily sentiment_avg from
    daily_scores.  Distinct from raw mention counts to avoid double-counting.

CP  Cross-Platform (10%)     — count of distinct platforms whose decay-weighted
    presence in the window (same λ as CA) is non-trivial, normalised by
    percentile rank against the pool.  Old-only activity stops counting, so
    cumulative 30-day history can never inflate cross-platform reach.

All pool-relative components (CA, M, AE) are percentile-ranked before
weighting so a single outlier cannot compress the rest of the pool.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import NamedTuple

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.config import settings
from app.models import DailyScore, Film, Mention, Ranking, Source
from app.services.confidence import confidence_tier


# ── helpers ──────────────────────────────────────────────────────────────────

def _ewma_series(values: list[float], half_life_days: float) -> list[float]:
    """Return EWMA of `values` (oldest first) for the given half-life in days.

    Uses the standard decay factor α = 1 − exp(−ln2 / half_life_days) so that
    the weight of a value halves after `half_life_days` steps.
    """
    if not values:
        return []
    alpha = 1.0 - math.exp(-math.log(2) / max(half_life_days, 1e-9))
    result: list[float] = []
    ema = values[0]
    result.append(ema)
    for v in values[1:]:
        ema = alpha * v + (1.0 - alpha) * ema
        result.append(ema)
    return result


def _percentile_rank(value: float, pool: list[float]) -> float:
    """Return the fraction of pool values strictly below `value` ∈ [0, 1]."""
    if not pool:
        return 0.0
    below = sum(1 for v in pool if v < value)
    return below / len(pool)


def _minmax_norm(value: float, lo: float, hi: float) -> float:
    """Normalise value to [0, 1] with safe fallback when lo == hi."""
    if hi == lo:
        return 0.5
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def _sigmoid_center(value: float, center: float, scale: float) -> float:
    """Sigmoid normalisation centred at `center`, returns (0, 1)."""
    return 1.0 / (1.0 + math.exp(-(value - center) / max(scale, 1e-9)))


# ── per-film data container ───────────────────────────────────────────────────

class _FilmData(NamedTuple):
    film_id: int
    # Log-transformed daily mentions, oldest-first, within window
    log_mentions: list[float]   # len = days tracked (≤ W)
    days_tracked: int
    active_days: int
    total_mentions: int
    # Daily sentiment averages within AE window, oldest-first
    sentiment_series: list[float]
    # Release date (or None)
    release_date: date | None


# ── main entry point ─────────────────────────────────────────────────────────

def recompute_rankings(db: Session) -> datetime:
    """Compute a fresh ranking snapshot and persist it to the database.

    Returns the snapshot timestamp.
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    cfg = settings
    W = cfg.ranking_ca_window_days          # max lookback days (default 30)
    lam = cfg.ranking_ca_lambda             # daily decay λ (default 0.89)
    short_hl = cfg.ranking_momentum_short_hl
    long_hl = cfg.ranking_momentum_long_hl
    ae_win = cfg.ranking_ae_window_days
    recency_win = cfg.ranking_recency_window_days
    min_days = cfg.ranking_min_tracked_days

    # ── 1. Load film metadata ─────────────────────────────────────────────────
    films: dict[int, Film] = {f.id: f for f in db.query(Film).all()}
    if not films:
        return now

    # ── 2. Load daily mention counts and sentiment (CA + M + AE window) ────────
    cutoff_ca = today - timedelta(days=W)
    cutoff_ae = today - timedelta(days=ae_win)
    cutoff_dt = now - timedelta(days=W)

    ds_rows = (
        db.query(DailyScore.film_id, DailyScore.day, DailyScore.mentions_count, DailyScore.sentiment_avg)
        .filter(DailyScore.day >= cutoff_ca)
        .all()
    )
    mentions_by_film: dict[int, dict[date, int]] = defaultdict(dict)
    sentiment_by_film: dict[int, dict[date, float]] = defaultdict(dict)
    for fid, day, cnt, savg in ds_rows:
        mentions_by_film[fid][day] = int(cnt or 0)
        if savg is not None:
            sentiment_by_film[fid][day] = float(savg)

    # Directly aggregate from Mention table for real-time coverage
    m_rows = (
        db.query(
            Mention.film_id,
            func.date(Mention.created_at).label("day"),
            func.count(Mention.id).label("cnt"),
            func.avg(Mention.sentiment_score).label("savg"),
        )
        .filter(Mention.created_at >= cutoff_dt)
        .group_by(Mention.film_id, func.date(Mention.created_at))
        .all()
    )
    for fid, day_val, cnt, savg in m_rows:
        d = day_val if isinstance(day_val, date) else datetime.strptime(str(day_val), "%Y-%m-%d").date()
        mentions_by_film[fid][d] = max(mentions_by_film[fid].get(d, 0), int(cnt or 0))
        if savg is not None:
            sentiment_by_film[fid][d] = float(savg)

    # ── 4. Load per-source daily activity (CP window = CA window) ─────────────
    # CP counts distinct platforms with *non-trivial decay-weighted* presence in
    # the window — the same λ decay used for Current Attention.  A platform that
    # was active weeks ago and silent since stops counting toward CP, exactly as
    # it already stops counting toward CA.  Raw volume never matters here: a
    # thousand old mentions on one day weigh the same as a single old mention.
    cp_rows = (
        db.query(
            Mention.film_id,
            func.date(Mention.created_at).label("day"),
            Mention.source_id,
        )
        .filter(Mention.created_at >= (now - timedelta(days=W)))
        .distinct()
        .all()
    )
    cp_days_by_source: dict[int, dict[int, set[date]]] = defaultdict(lambda: defaultdict(set))
    for fid, day_val, sid in cp_rows:
        d = day_val if isinstance(day_val, date) else datetime.strptime(str(day_val), "%Y-%m-%d").date()
        cp_days_by_source[fid][sid].add(d)

    cp_min_signal = settings.ranking_cp_min_signal
    cp_raw_map: dict[int, float] = {}
    for fid, src_days in cp_days_by_source.items():
        cp_raw_map[fid] = float(sum(
            1.0
            for days in src_days.values()
            if sum(lam ** max((today - d).days, 0) for d in days) >= cp_min_signal
        ))

    # ── 5. Build per-film data objects ────────────────────────────────────────
    all_days_ca = [cutoff_ca + timedelta(days=i) for i in range(W + 1)]
    all_days_ae = [cutoff_ae + timedelta(days=i) for i in range(ae_win + 1)]

    film_data: list[_FilmData] = []
    for fid, film in films.items():
        # CA / M: log-transformed daily mention series, oldest→newest
        day_mentions = mentions_by_film.get(fid, {})
        log_series = [
            math.log1p(day_mentions.get(d, 0))
            for d in all_days_ca
            if d <= today
        ]
        active_days = sum(1 for v in log_series if v > 0)
        total_m = sum(day_mentions.get(d, 0) for d in all_days_ca if d <= today)

        # Trim trailing zeros to find actual first non-zero day
        # "days tracked" = distance from first mention day to today
        first_active = next(
            (i for i, v in enumerate(log_series) if v > 0), None
        )
        if first_active is not None:
            days_tracked = len(log_series) - first_active
        else:
            days_tracked = 0

        # AE: sentiment series
        day_sentiments = sentiment_by_film.get(fid, {})
        sentiment_series = [
            float(day_sentiments.get(d, 0.0))
            for d in all_days_ae
            if d <= today
        ]

        film_data.append(_FilmData(
            film_id=fid,
            log_mentions=log_series,
            days_tracked=days_tracked,
            active_days=active_days,
            total_mentions=total_m,
            sentiment_series=sentiment_series,
            release_date=film.release_date,
        ))

    # ── 6. Compute raw scores per component ───────────────────────────────────

    # An actively tracked film must have at least min_days of distinct mention days OR >=2 mentions.
    # Inactive/dormant titles (0 mentions or 1 isolated ingest mention) do NOT participate in
    # active signal pools and receive 0 for CA, M, and AE.
    active_fids = {
        fd.film_id for fd in film_data
        if (fd.active_days >= min_days and fd.total_mentions >= 2) or fd.total_mentions >= 5
    }
    if not active_fids:
        active_fids = {fd.film_id for fd in film_data if fd.total_mentions > 0} or {fd.film_id for fd in film_data}

    # ── Evidence floor for editorial claims ───────────────────────────────────
    # sample_size = raw mention/signal count feeding CA/M/AE (pre-normalization).
    # Confidence is derived from this absolute count only — percentile rank is
    # relative to a possibly-quiet pool and must never be the sole gate.
    sample_size_map: dict[int, int] = {fd.film_id: fd.total_mentions for fd in film_data}
    confidence_map: dict[int, str] = {
        fid: confidence_tier(n) for fid, n in sample_size_map.items()
    }

    ca_raw: dict[int, float] = {}
    m_raw: dict[int, float] = {}
    r_raw: dict[int, float] = {}
    ae_raw: dict[int, float] = {}
    cp_raw: dict[int, float] = {}

    for fd in film_data:
        fid = fd.film_id
        film = films[fid]

        # ── R: linear recency decay ───────────────────────────────────────────
        release = fd.release_date
        if release is None:
            created = film.created_at
            if created:
                release = (
                    created.date()
                    if isinstance(created, datetime)
                    else created
                )
        if release is not None:
            if isinstance(release, datetime):
                release = release.date()
            days_since = (today - release).days
            if 0 <= days_since <= recency_win:
                r_raw[fid] = 1.0 - (days_since / recency_win)
            else:
                r_raw[fid] = 0.0
        else:
            r_raw[fid] = 0.0

        if fid in active_fids:
            # ── CA: recency-weighted average over actual tracked days ─────────────
            T = min(W, max(fd.days_tracked, 0))
            if T >= min_days and fd.log_mentions:
                # Use only the most recent T days
                series = fd.log_mentions[-T:]
                # Weights: λ^(T-1-d) for d=0..T-1 (most recent day gets weight 1)
                weights = [lam ** (T - 1 - d) for d in range(T)]
                w_sum = sum(weights)
                ca_raw[fid] = sum(s * w for s, w in zip(series, weights)) / w_sum
            else:
                ca_raw[fid] = 0.0

            # ── M: EWMA_short − EWMA_long ─────────────────────────────────────────
            series = fd.log_mentions
            if len(series) >= 2:
                ewma_s = _ewma_series(series, short_hl)
                ewma_l = _ewma_series(series, long_hl)
                m_raw[fid] = ewma_s[-1] - ewma_l[-1]
            else:
                m_raw[fid] = 0.0

            # ── AE: EWMA of daily sentiment ───────────────────────────────────────
            if len(fd.sentiment_series) >= min_days:
                ae_ewma = _ewma_series(fd.sentiment_series, ae_win / 2.0)
                # Sentiment is in [-1, 1]; shift to [0, 1]
                ae_raw[fid] = (ae_ewma[-1] + 1.0) / 2.0
            else:
                ae_raw[fid] = 0.5  # neutral default for actively tracked titles

            # ── CP: decay-weighted distinct platform count ────────────────────────
            cp_raw[fid] = cp_raw_map.get(fid, 0.0)
        else:
            ca_raw[fid] = 0.0
            m_raw[fid] = 0.0
            ae_raw[fid] = 0.0
            cp_raw[fid] = 0.0

    # ── 7. Pool-relative normalisation ───────────────────────────────────────
    all_fids = list(ca_raw.keys())

    active_ca = [ca_raw[fid] for fid in active_fids]
    active_ae = [ae_raw[fid] for fid in active_fids]
    active_m = [m_raw[fid] for fid in active_fids]
    active_cp = [cp_raw[fid] for fid in active_fids]

    m_pos_max = max([v for v in active_m if v > 0], default=1.0) or 1.0
    m_neg_min = min([v for v in active_m if v < 0], default=-1.0) or -1.0

    ca_norm: dict[int, float] = {}
    m_norm: dict[int, float] = {}
    ae_norm: dict[int, float] = {}
    cp_norm: dict[int, float] = {}

    for fid in all_fids:
        if fid in active_fids:
            ca_norm[fid] = _percentile_rank(ca_raw[fid], active_ca)
            ae_norm[fid] = _percentile_rank(ae_raw[fid], active_ae)
            # Center momentum around 0.5 for active films:
            mv = m_raw[fid]
            if mv >= 0:
                m_norm[fid] = 0.5 + 0.5 * (mv / m_pos_max)
            else:
                m_norm[fid] = 0.5 - 0.45 * (abs(mv) / abs(m_neg_min))
            cp_norm[fid] = _percentile_rank(cp_raw[fid], active_cp)
        else:
            ca_norm[fid] = 0.0
            m_norm[fid] = 0.0
            ae_norm[fid] = 0.0
            cp_norm[fid] = 0.0

    # ── 8. Weighted final score ───────────────────────────────────────────────
    WEIGHTS = dict(ca=0.30, m=0.25, r=0.20, ae=0.15, cp=0.10)
    MAX_INDEX_SCORE = 98.5

    # Recency gate: films released more than recency_win days ago cannot
    # participate in CA, M, or AE pools.  They keep only R (which is 0
    # past the window) and CP, so they naturally drop to the bottom.
    stale_fids = {
        fd.film_id for fd in film_data
        if fd.release_date is not None and (today - fd.release_date).days > recency_win
    }
    # Also exclude films with no release date AND no recent mentions (7d)
    recent_cutoff = today - timedelta(days=7)
    has_recent_mentions = {
        fd.film_id for fd in film_data
        if any(d >= recent_cutoff for d in mentions_by_film.get(fd.film_id, {}).keys())
    }
    stale_fids.update(
        fd.film_id for fd in film_data
        if fd.film_id not in has_recent_mentions
        and fd.film_id not in active_fids
    )

    composite: dict[int, float] = {}
    for fid in all_fids:
        if fid in stale_fids:
            # Stale film: zero out attention/momentum/engagement, keep only
            # recency (which is already 0 past the window) and CP.
            composite[fid] = (
                WEIGHTS["r"] * r_raw[fid]
                + WEIGHTS["cp"] * cp_norm.get(fid, 0.0)
            )
        else:
            composite[fid] = (
                WEIGHTS["ca"] * ca_norm[fid]
                + WEIGHTS["m"] * m_norm[fid]
                + WEIGHTS["r"] * r_raw[fid]
                + WEIGHTS["ae"] * ae_norm[fid]
                + WEIGHTS["cp"] * cp_norm.get(fid, 0.0)
            )

    if not composite:
        return now

    max_composite = max(composite.values()) or 1.0
    normalized = sorted(
        [(fid, round(s * MAX_INDEX_SCORE / max_composite, 1)) for fid, s in composite.items()],
        key=lambda x: -x[1],
    )

    # ── 9. Previous snapshot lookup for movement tracking ─────────────────────
    prev_snap = db.scalar(select(func.max(Ranking.snapshot_at)))
    prev_ranks: dict[int, int] = {}
    prev_movements: dict[int, int | None] = {}
    prev_prev_ranks: dict[int, int | None] = {}
    prev_peak: dict[int, int] = {}
    if prev_snap:
        for r in db.query(Ranking).filter(Ranking.snapshot_at == prev_snap):
            prev_ranks[r.film_id] = r.rank
            prev_movements[r.film_id] = r.movement
            prev_prev_ranks[r.film_id] = r.prev_rank
            prev_peak[r.film_id] = r.peak_rank or r.rank

    def _movement_for(fid: int, rank: int) -> tuple[int | None, int]:
        """Return (prev_rank, movement) for this snapshot.

        Movement is rank-based and PERSISTENT: the ↑/↓/— indicator keeps
        showing the last rank change until the rank actually changes again.
        Comparing only against the immediately-previous snapshot (which fires
        every refresh cycle) would reset a real move to "—" within minutes
        whenever a film holds its new position.
        """
        prev = prev_ranks.get(fid)
        if prev is None:
            return None, 0  # first appearance — a genuine NEW entry
        if prev != rank:
            return prev, prev - rank  # rank changed → fresh movement
        # Rank unchanged from the previous snapshot: carry the last movement
        # forward until the rank changes again. A debut that held its rank
        # resolves to steady (movement 0, prev_rank set) instead of showing
        # a perpetual "New" badge.
        carried = prev_movements.get(fid)
        movement = carried if carried is not None else 0
        last_from = prev_prev_ranks.get(fid)
        return (last_from if last_from is not None else prev), movement

    # ── Weeks on chart: calendar weeks since the film's FIRST chart appearance.
    # The previous implementation carried a counter and incremented it on every
    # ranking run — which fires every 15 minutes — so "8 weeks on chart" could
    # really mean "tracked for 2 hours", and re-entries showed NEW alongside an
    # inflated count.  Deriving the count from the earliest snapshot keeps the
    # number truthful and self-heals the inflated values already persisted by
    # older runs: the next snapshot simply writes the correct number.
    first_seen: dict[int, datetime] = {
        fid: first_snap
        for fid, first_snap in db.query(
            Ranking.film_id, func.min(Ranking.snapshot_at)
        ).group_by(Ranking.film_id).all()
    }

    def _weeks_on_chart(fid: int) -> int:
        start = first_seen.get(fid)
        if start is None:
            return 1  # first appearance is this snapshot
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        return max(((now - start).days // 7) + 1, 1)

    # ── 10. Persist snapshot ──────────────────────────────────────────────────
    for i, (fid, score) in enumerate(normalized, start=1):
        prev_rank_out, movement = _movement_for(fid, i)
        peak = min(prev_peak.get(fid, i), i)
        db.add(Ranking(
            snapshot_at=now,
            film_id=fid,
            rank=i,
            score=score,
            prev_rank=prev_rank_out,
            movement=movement,
            peak_rank=peak,
            weeks_on_chart=_weeks_on_chart(fid),
            # Sub-score audit log (stored as normalised 0-1 values)
            ca_score=round(ca_norm[fid], 4),
            momentum_score=round(m_norm[fid], 4),
            recency_score=round(r_raw[fid], 4),
            ae_score=round(ae_norm[fid], 4),
            cp_score=round(cp_norm[fid], 4),
            # Absolute evidence floor (raw count + derived tier)
            sample_size=sample_size_map.get(fid, 0),
            confidence=confidence_map.get(fid, "insufficient"),
        ))
    db.commit()
    return now
