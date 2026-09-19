"""Ranking engine — five-component windowed scoring model.

FinalScore = 0.30·CA + 0.25·M + 0.20·R + 0.15·AE + 0.10·CP

No component ever sums over the full lifetime of a title's history.  Every
input is time-windowed, EWMA-weighted, or a bounded function of signal age.
A newly released title is never structurally disadvantaged versus one that
has been tracked for months, and — critically — recency measures SIGNAL
ACTIVITY, not release date: an old film that suddenly explodes culturally
can reach #1.

Component overview
──────────────────
CA  Current Attention (30%)  — recency-weighted log-mention average over the
    last W days, normalised by actual days tracked, so a 3-day-old film is
    not penalised for lacking history.

M   Momentum (25%)           — EWMA_short − EWMA_long on the same log-mention
    series.  Absolute delta, never a growth-rate, so divide-by-zero is
    impossible for titles in their first few days.

R   Recency (20%)            — decay of SIGNAL ACTIVITY: linear falloff from
    1.0 when the most recent real mention is today to 0.0 when the newest
    measured activity is 21 days old.  Release date is irrelevant here.

AE  Audience Engagement (15%)— 14-day EWMA of daily sentiment_avg from
    daily_scores.  Distinct from raw mention counts to avoid double-counting.

CP  Cross-Platform (10%)     — count of distinct platforms whose decay-weighted
    presence in the window (same λ as CA) is non-trivial, normalised against
    the pool.  Old-only activity stops counting, so cumulative 30-day history
    can never inflate cross-platform reach.

Normalisation
─────────────
All pool-relative components (CA, M, AE, CP) are normalised with a ROBUST
median/MAD sigmoid rather than a discrete percentile rank.  Percentile
normalisation quantises the pool onto len(pool)+1 discrete levels — with a
small active pool this collapsed large groups of titles onto identical
composites (the "68.8 / 68.8 / 27.8 / 27.8" defect).  The robust sigmoid is
continuous, outlier-resistant (median/MAD, not min/max), and only produces
identical outputs when raw inputs are genuinely identical.

Index Score
───────────
A universal 0–100 mapping of the raw composite.  It is derived ONLY from
measured signals — never from rank position.  The map
    score = 100 · (1 − exp(−3 · composite / p95))
anchors at the pool's 95th composite percentile: a title at the 95th
percentile of measured momentum scores ≈ 95, a compressed (quiet) field
spreads lower, a runaway leader approaches but never trivially reaches 100
(3× the p95 composite rounds to 100.0 — technically achievable,
exceptionally rare).  Internal precision is kept in the composite; the
persisted score carries 2 decimals and the API displays 1.

Charts
──────
The engine computes TWO official charts per cycle — MOVIE_100 and TV_100 —
from the same signal layer.  Rank is ALWAYS contextual to a chart: a
persisted rank is the title's position within its own chart's candidate
ordering, capped at 100.  Candidates beyond position 100 are NOT persisted
at all — internal candidate positions beyond the published range never
become visible as "rank #153".
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
from app.services.confidence import CATALOG_ONLY_SOURCE_KEYS, confidence_tier


# ── chart identity ───────────────────────────────────────────────────────────

MOVIE_100 = "MOVIE_100"
TV_100 = "TV_100"
OFFICIAL_CHARTS: tuple[tuple[str, str], ...] = (
    (MOVIE_100, "MOVIE"),
    (TV_100, "TV_SHOW"),
)
CHART_SIZE = 100


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
    """Discrete percentile rank ∈ [0, 1] — kept for diagnostics/tests only.

    NOT used for score normalisation anymore: with a small pool it quantises
    values onto discrete levels, which produced the repeated-score defect.
    """
    if not pool:
        return 0.0
    below = sum(1 for v in pool if v < value)
    return below / len(pool)


def _percentile(values: list[float], q: float) -> float:
    """Linear-interpolation percentile of `values` at fraction q ∈ [0, 1]."""
    if not values:
        return 0.0
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    pos = (len(s) - 1) * min(max(q, 0.0), 1.0)
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return s[lo]
    frac = pos - lo
    return s[lo] + (s[hi] - s[lo]) * frac


def _robust_sig(value: float, pool: list[float]) -> float:
    """Robust pool normalisation → continuous value in (0, 1).

    Maps `value` through a sigmoid centred at the pool median with scale
    1.4826·MAD (the consistent estimate of σ under normality).  Falls back to
    IQR, then to range, then to a constant.  Outliers saturate the sigmoid
    without compressing the resolution of the rest of the pool, and identical
    outputs occur only when the underlying measurements are identical.
    """
    if not pool:
        return 0.5
    s = sorted(pool)
    med = _percentile(s, 0.5)
    abs_dev = sorted(abs(v - med) for v in s)
    sigma = 1.4826 * _percentile(abs_dev, 0.5)
    if sigma <= 1e-9:
        # Degenerate MAD — every pooled value is (nearly) identical.
        q1, q3 = _percentile(s, 0.25), _percentile(s, 0.75)
        sigma = (q3 - q1) / 1.349
    if sigma <= 1e-9:
        lo, hi = s[0], s[-1]
        sigma = (hi - lo) / 4.0 if hi > lo else 0.0
    if sigma <= 1e-9:
        # Genuinely flat pool: nothing to discriminate.
        return 0.5
    z = (value - med) / sigma
    return 1.0 / (1.0 + math.exp(-0.9 * z))


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
    # Most recent calendar day with a real (non-catalog) mention
    last_signal_day: date | None
    content_type: str = "MOVIE"


# ── main entry point ─────────────────────────────────────────────────────────

def recompute_rankings(db: Session) -> datetime:
    """Compute a fresh ranking snapshot and persist it to the database.

    Writes one continuous snapshot per official chart (MOVIE_100, TV_100),
    each capped at CHART_SIZE (100) published positions.  Returns the
    snapshot timestamp.
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

    # ── TMDB firewall ─────────────────────────────────────────────────────────
    # Catalog-only sources ("tmdb") must never feed a ranking component.  The
    # exclusion is applied once, to every Mention/DailyScore aggregation below.
    catalog_source_ids: list[int] = [
        sid for (sid,) in db.query(Source.id).filter(Source.key.in_(CATALOG_ONLY_SOURCE_KEYS)).all()
    ]
    has_catalog_rows = bool(catalog_source_ids)

    # ── 2. Load daily mention counts and sentiment (CA + M + AE window) ────────
    cutoff_ca = today - timedelta(days=W)
    cutoff_ae = today - timedelta(days=ae_win)
    cutoff_dt = now - timedelta(days=W)

    ds_q = db.query(
        DailyScore.film_id, DailyScore.day, DailyScore.mentions_count, DailyScore.sentiment_avg
    ).filter(DailyScore.day >= cutoff_ca)
    if has_catalog_rows:
        # DailyScore rows that came purely from catalog-only sources are not
        # signals; subtract their per-day contribution.
        catalog_ds_rows = (
            db.query(
                Mention.film_id,
                func.date(Mention.created_at).label("day"),
                func.count(Mention.id).label("cnt"),
                func.avg(Mention.sentiment_score).label("savg"),
            )
            .filter(Mention.source_id.in_(catalog_source_ids), Mention.created_at >= cutoff_dt)
            .group_by(Mention.film_id, func.date(Mention.created_at))
            .all()
        )
        catalog_ds: dict[tuple[int, date], tuple[int, float]] = {}
        for fid, day_val, cnt, savg in catalog_ds_rows:
            d = day_val if isinstance(day_val, date) else datetime.strptime(str(day_val), "%Y-%m-%d").date()
            catalog_ds[(fid, d)] = (int(cnt or 0), float(savg or 0.0))

    ds_rows = ds_q.all()
    mentions_by_film: dict[int, dict[date, int]] = defaultdict(dict)
    sentiment_by_film: dict[int, dict[date, float]] = defaultdict(dict)
    for fid, day, cnt, savg in ds_rows:
        key = (fid, day)
        if has_catalog_rows and key in catalog_ds:
            # Strip the catalog-only contribution out of the rolled-up counts.
            c_cnt, c_savg = catalog_ds[key]
            real_cnt = int(cnt or 0) - c_cnt
            if real_cnt <= 0:
                continue  # this day's row was purely catalog data — not a signal
            # Recompute the real sentiment average without the catalog rows
            # (weighted by counts, capped to [-1, 1] for safety).
            total = int(cnt or 0)
            real_savg = ((float(savg or 0.0) * total) - (c_savg * c_cnt)) / real_cnt
            real_savg = max(-1.0, min(1.0, real_savg))
            cnt, savg = real_cnt, real_savg
        mentions_by_film[fid][day] = int(cnt or 0)
        if savg is not None:
            sentiment_by_film[fid][day] = float(savg)

    # Directly aggregate from Mention table for real-time coverage
    m_q = (
        db.query(
            Mention.film_id,
            func.date(Mention.created_at).label("day"),
            func.count(Mention.id).label("cnt"),
            func.avg(Mention.sentiment_score).label("savg"),
        )
        .filter(Mention.created_at >= cutoff_dt)
    )
    if has_catalog_rows:
        m_q = m_q.filter(~Mention.source_id.in_(catalog_source_ids))
    m_rows = m_q.group_by(Mention.film_id, func.date(Mention.created_at)).all()
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
    cp_rows_q = (
        db.query(
            Mention.film_id,
            func.date(Mention.created_at).label("day"),
            Mention.source_id,
        )
        .filter(Mention.created_at >= (now - timedelta(days=W)))
    )
    if has_catalog_rows:
        cp_rows_q = cp_rows_q.filter(~Mention.source_id.in_(catalog_source_ids))
    cp_rows = cp_rows_q.distinct().all()
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

        last_signal = max((d for d, c in day_mentions.items() if c > 0), default=None)

        film_data.append(_FilmData(
            film_id=fid,
            log_mentions=log_series,
            days_tracked=days_tracked,
            active_days=active_days,
            total_mentions=total_m,
            sentiment_series=sentiment_series,
            last_signal_day=last_signal,
            content_type=film.content_type or "MOVIE",
        ))

    # ── 6. Compute raw scores per component ───────────────────────────────────

    # Chart eligibility: a title participates in the signal pools and can hold
    # a chart position iff it has at least one measured signal inside the CA
    # window.  Titles with zero measured signals are "not currently ranked" —
    # they are never persisted, so no phantom positions and no #1247-style
    # internal ranks can leak.  Dormancy is expressed by the scores themselves:
    # λ-decayed attention and signal-activity recency sink cold titles to the
    # bottom, and the 100-position cap naturally drops them off the chart.
    active_fids = {
        fd.film_id for fd in film_data
        if fd.total_mentions > 0
    }

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

        # ── R: signal-activity recency ────────────────────────────────────────
        # Measures how recently the title generated real measured activity —
        # NOT how recently it was released.  A decades-old film that is being
        # discussed today scores R = 1.0; a new title that went silent 21 days
        # ago scores R = 0.0.  No release-date bonus, no release-date penalty.
        if fd.last_signal_day is not None:
            days_since_signal = max((today - fd.last_signal_day).days, 0)
            if 0 <= days_since_signal <= recency_win:
                r_raw[fid] = 1.0 - (days_since_signal / recency_win)
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
    # Query latest YouTube signals per film (if table exists) for multi-modal scoring
    from app.models.youtube import YouTubeSignal
    yt_signals: dict[int, YouTubeSignal] = {}
    try:
        yt_rows = db.query(YouTubeSignal).order_by(YouTubeSignal.fetched_at.desc()).all()
        for row in yt_rows:
            if row.film_id not in yt_signals:
                yt_signals[row.film_id] = row
    except Exception:
        yt_signals = {}

    # Derived YouTube signals for active films
    yt_ca_raw: dict[int, float] = {}
    yt_m_raw: dict[int, float] = {}
    yt_ae_raw: dict[int, float] = {}
    for fid, sig in yt_signals.items():
        if fid in active_fids and sig.view_count > 0:
            # Attention: log view velocity (views/day)
            yt_ca_raw[fid] = math.log1p(sig.view_velocity if sig.view_velocity > 0 else sig.view_count / 30.0)
            if sig.view_velocity > 0:
                yt_m_raw[fid] = math.log1p(sig.view_velocity)
            # Engagement: like & comment density per log view count
            reaction_density = (sig.like_count * 2.0 + sig.comment_count * 5.0) / max(math.log1p(sig.view_count), 1.0)
            yt_ae_raw[fid] = reaction_density

    yt_ca_pool = list(yt_ca_raw.values())
    yt_m_pool = list(yt_m_raw.values())
    yt_ae_pool = list(yt_ae_raw.values())

    all_fids = list(ca_raw.keys())

    active_ca = [ca_raw[fid] for fid in active_fids]
    active_ae = [ae_raw[fid] for fid in active_fids]
    active_m = [m_raw[fid] for fid in active_fids]
    active_cp = [cp_raw[fid] for fid in active_fids]

    ca_norm: dict[int, float] = {}
    m_norm: dict[int, float] = {}
    ae_norm: dict[int, float] = {}
    cp_norm: dict[int, float] = {}

    def _norm_pool(val: float, pool: list[float]) -> float:
        if not pool:
            return 0.5
        lo = min(pool)
        hi = max(pool)
        if hi == lo:
            return 1.0 if val > 0 else 0.5
        return max(0.0, min(1.0, (val - lo) / (hi - lo)))

    for fid in all_fids:
        if fid in active_fids:
            ca_base = _robust_sig(ca_raw[fid], active_ca)
            if fid in yt_ca_raw and yt_ca_pool:
                yt_ca_pct = _norm_pool(yt_ca_raw[fid], yt_ca_pool)
                ca_norm[fid] = 0.75 * ca_base + 0.25 * yt_ca_pct
            else:
                ca_norm[fid] = ca_base  # Graceful fallback: 100% pre-YouTube attention

            ae_base = _robust_sig(ae_raw[fid], active_ae)
            if fid in yt_ae_raw and yt_ae_pool:
                yt_ae_pct = _norm_pool(yt_ae_raw[fid], yt_ae_pool)
                ae_norm[fid] = 0.80 * ae_base + 0.20 * yt_ae_pct
            else:
                ae_norm[fid] = ae_base  # Graceful fallback: 100% pre-YouTube sentiment

            m_base = _robust_sig(m_raw[fid], active_m)
            if fid in yt_m_raw and yt_m_pool:
                yt_m_pct = _norm_pool(yt_m_raw[fid], yt_m_pool)
                m_norm[fid] = 0.80 * m_base + 0.20 * yt_m_pct
            else:
                m_norm[fid] = m_base  # Graceful fallback: 100% pre-YouTube momentum

            # CP is a platform COUNT — two titles with the same number of
            # active platforms legitimately share the same CP value (exact
            # ties are honest here).  The discrete percentile is kept for CP
            # only; the continuous components use the robust sigmoid above.
            cp_norm[fid] = _percentile_rank(cp_raw[fid], active_cp)
        else:
            ca_norm[fid] = 0.0
            m_norm[fid] = 0.0
            ae_norm[fid] = 0.0
            cp_norm[fid] = 0.0

    # ── 8. Weighted final score ───────────────────────────────────────────────
    WEIGHTS = dict(ca=0.30, m=0.25, r=0.20, ae=0.15, cp=0.10)

    composite: dict[int, float] = {}
    for fid in all_fids:
        composite[fid] = (
            WEIGHTS["ca"] * ca_norm[fid]
            + WEIGHTS["m"] * m_norm[fid]
            + WEIGHTS["r"] * r_raw[fid]
            + WEIGHTS["ae"] * ae_norm[fid]
            + WEIGHTS["cp"] * cp_norm.get(fid, 0.0)
        )

    if not composite:
        return now

    # ── Score scale: signal-driven, never rank-derived ─────────────────────
    # The Index Score maps the raw composite onto the universal 0–100 scale
    # through the pool's own measured distribution:
    #
    #     score = 100 · (1 − exp(−3 · composite / p95))
    #
    # p95 is the 95th percentile of the eligible pool's composites.  There is
    # no rank→score mapping anywhere: the #1 spot earns whatever its signals
    # measure.  A compressed (quiet) field spreads the chart lower; a runaway
    # leader pushes toward but never trivially reaches 100 — a composite 3×
    # the p95 anchor rounds to 100.0, which is technically achievable and
    # exceptionally rare by construction.
    p95_anchor = _percentile([composite[f] for f in active_fids], 0.95)
    if p95_anchor <= 1e-9:
        p95_anchor = 1e-9
    score_map: dict[int, float] = {
        fid: 100.0 * (1.0 - math.exp(-3.0 * (c / p95_anchor)))
        for fid, c in composite.items()
    }

    # ── 9. Previous snapshot lookup for movement tracking (per chart) ──────────
    prev_snap = db.scalar(select(func.max(Ranking.snapshot_at)))

    # ── Weeks on chart: calendar weeks since the title's FIRST chart appearance
    # (chart-scoped).  Derived from the earliest snapshot — never a carried
    # counter — so the number stays truthful and self-heals.
    def _chart_first_seen(chart_id: str) -> dict[int, datetime]:
        return {
            fid: first_snap
            for fid, first_snap in db.query(Ranking.film_id, func.min(Ranking.snapshot_at))
            .filter(Ranking.chart_type == chart_id)
            .group_by(Ranking.film_id)
            .all()
        }

    def _weeks_on_chart(fid: int, first_seen: dict[int, datetime]) -> int:
        start = first_seen.get(fid)
        if start is None:
            return 1  # first appearance is this snapshot
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        return max(((now - start).days // 7) + 1, 1)

    # ── 10. Persist snapshot — one continuous series per official chart ───────
    content_type_by_fid = {fd.film_id: fd.content_type for fd in film_data}
    for chart_id, entity_ct in OFFICIAL_CHARTS:
        # Chart qualification: the eligible pool restricted to this chart's
        # entity type.  Movies never receive TV ranks and vice versa.  Uses
        # the coerced content type (NULL legacy rows → MOVIE).
        chart_pool = [
            (fid, c) for fid, c in composite.items()
            if fid in active_fids and content_type_by_fid[fid] == entity_ct
        ]
        # Deterministic order: composite desc, then evidence volume, then id.
        ordered = sorted(
            chart_pool,
            key=lambda x: (-x[1], sample_size_map.get(x[0], 0), x[0]),
        )[:CHART_SIZE]

        if not ordered:
            continue

        chart_first_seen = _chart_first_seen(chart_id)

        prev_ranks: dict[int, int] = {}
        prev_peak: dict[int, int] = {}
        if prev_snap:
            for r in (
                db.query(Ranking)
                .filter(Ranking.snapshot_at == prev_snap, Ranking.chart_type == chart_id)
            ):
                prev_ranks[r.film_id] = r.rank
                prev_peak[r.film_id] = r.peak_rank or r.rank

        # Movement baseline: the rank as of ~24 hours ago, within this chart.
        cutoff = now - timedelta(hours=24)
        if prev_snap is not None and prev_snap.tzinfo is None:
            cutoff = cutoff.replace(tzinfo=None)  # column stores naive UTC
        baseline_ranks: dict[int, int] = {}
        for fid, window_rank in (
            db.query(Ranking.film_id, Ranking.rank)
            .filter(
                Ranking.snapshot_at >= cutoff,
                Ranking.chart_type == chart_id,
            )
            .order_by(Ranking.snapshot_at.asc())
        ):
            # Ascending scan: the FIRST (oldest) snapshot per film wins.
            baseline_ranks.setdefault(fid, window_rank)

        for i, (fid, comp) in enumerate(ordered, start=1):
            baseline = baseline_ranks.get(fid)
            if baseline is None:
                prev_rank_out, movement = prev_ranks.get(fid), 0
                if prev_ranks.get(fid) is None:
                    movement = 0
                    prev_rank_out = None
            elif baseline != i:
                prev_rank_out, movement = baseline, baseline - i
            else:
                # Rank unchanged across the window → steady ("—").
                prev_rank_out, movement = prev_ranks.get(fid, baseline), 0
            peak = min(prev_peak.get(fid, i), i)
            db.add(Ranking(
                snapshot_at=now,
                chart_type=chart_id,
                film_id=fid,
                rank=i,
                score=round(score_map[fid], 2),
                prev_rank=prev_rank_out,
                movement=movement,
                peak_rank=peak,
                weeks_on_chart=_weeks_on_chart(fid, chart_first_seen),
                # Sub-score audit log (normalised 0-1 values)
                ca_score=round(ca_norm[fid], 4),
                momentum_score=round(m_norm[fid], 4),
                recency_score=round(r_raw[fid], 4),
                ae_score=round(ae_norm[fid], 4),
                cp_score=round(cp_norm[fid], 4),
                # Raw cultural momentum (pre-scale) — admin inspector only
                composite_raw=round(comp, 6),
                # Absolute evidence floor (raw count + derived tier)
                sample_size=sample_size_map.get(fid, 0),
                confidence=confidence_map.get(fid, "insufficient"),
            ))

    db.commit()
    return now
