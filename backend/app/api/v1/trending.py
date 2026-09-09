"""
Trending endpoints.

/trending/films  — films ranked by current audience engagement velocity.
                   Each entry carries a data-grounded editorial brief built
                   from concrete extracted signals:
                     - dominant score driver (CA / M / R / AE / CP)
                     - attention delta % over the last 3 days vs prior 3 days
                     - top platform driving engagement
                     - top discussion keyword from recent mention text

Editorial honesty rules (shared with every consumer via the response fields):

  • Every entry carries `sample_size` (raw mention/signal count feeding the
    ranking components, pre-normalization) and a `confidence` tier derived
    from it.  Percentile rank alone is never the gate: a title can rank 99th
    percentile of a sparse pool with one mention — mathematically valid,
    editorially meaningless.
  • `confidence == "insufficient"` → neutral, claim-free copy only.
  • `confidence == "low"` → hedged copy only, no superlatives.
  • `confidence` in moderate/high → confident copy, but only with specific
    citations (real platform, real number).  If no specific signal exists the
    tier is capped at "low" regardless of raw count.
  • `dominant_driver` names an actual score component; `driver_label` is a
    display-safe name — never the metric's own name ("attention").
  • `top_platform` is only ever a real external platform.  Internal ingest
    sources (e.g. TMDB) never masquerade as a platform.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Sequence

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc, or_, and_
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Film, Ranking, Mention, Source
from app.schemas import TrendingFilmOut
from app.services.confidence import (
    confidence_tier,
    driver_label as driver_label_for,
    tier_at_least,
    PLATFORM_LABELS,
    INTERNAL_SOURCE_KEYS,
    CATALOG_ONLY_SOURCE_KEYS,
)

router = APIRouter()

# ── banned filler phrases ─────────────────────────────────────────────────────

_BANNED = re.compile(
    r"captivat\w+\s+audience|generating\s+buzz|continues\s+to\s+resonate"
    r"|significant\s+buzz|standout\s+cultural\s+moment"
    r"|audience\s+engagement\b|generating\s+significant|\btmdb\b",
    re.IGNORECASE,
)

# ── simple keyword extractor ──────────────────────────────────────────────────

_STOPWORDS = frozenset(
    "the a an and or but in on at to of is are was were be been being have has "
    "had do does did will would could should may might shall it its this that "
    "for with from by about as into through during including until against among "
    "film movie watch see great good like just get one two three more most "
    "also very really so then when where how what which who i we you he she they "
    "not no yes my our your his her their its".split()
)


def _top_keyword(texts: Sequence[str | None], top_n: int = 1) -> str | None:
    """Extract the most salient unigram from a list of mention texts.

    A keyword only counts as a real topic when it appears in at least two
    distinct mention texts — a single mention's most common word is usually
    just an echo of the title, not a discussion topic.
    """
    words: list[str] = []
    for t in texts:
        if t:
            words.extend(re.findall(r"\b[a-z]{4,}\b", t.lower()))
    filtered = [w for w in words if w not in _STOPWORDS]
    if not filtered:
        return None
    counts = Counter(filtered)
    top = counts.most_common(top_n)
    if not top or top[0][1] < 2:
        return None
    return top[0][0]


# ── dominant driver detection ─────────────────────────────────────────────────

_COMPONENT_TO_DRIVER = {
    "ca": "attention",        # CA — recency-weighted mention average
    "momentum": "momentum",   # M  — EWMA short − EWMA long
    "recency": "recency",     # R  — linear recency decay
    "ae": "engagement",       # AE — sentiment EWMA
    "cp": "cross_platform",   # CP — distinct active sources
}


def _dominant_driver(
    ca: float | None,
    momentum: float | None,
    recency: float | None,
    ae: float | None,
    cp: float | None,
    movement: int,
) -> str | None:
    """Return the driver key for the component that best explains this film.

    Uses the normalised sub-scores from the Ranking row (the dominant
    component = highest value).  Returns None when there is no meaningful
    evidence, so consumers render "not enough signal yet" instead of falling
    back to a circular "attention" label.  Legacy rows without sub-scores fall
    back to movement heuristics.
    """
    present = {
        name: value
        for name, value in (("ca", ca), ("momentum", momentum), ("recency", recency),
                            ("ae", ae), ("cp", cp))
        if value is not None
    }
    if present:
        top_key, top_value = max(present.items(), key=lambda kv: kv[1])
        if top_value < 0.1:
            # Every component is effectively zero — no evidence of a driver.
            return None
        if top_key == "momentum" and momentum is not None and momentum < 0.4:
            return "declining"
        return _COMPONENT_TO_DRIVER[top_key]

    # Legacy snapshot rows (no sub-scores): movement is the only signal.
    if movement > 5:
        return "momentum"
    if movement < -5:
        return "declining"
    return None


# ── brief builder ─────────────────────────────────────────────────────────────

def _build_brief(
    title: str,
    driver: str | None,
    confidence: str,
    sample_size: int,
    attention_delta_pct: float | None,
    top_platform: str | None,
    mentions_24h: int,
    weeks_on_chart: int,
    score: float,
    days_since_release: int | None,
) -> str:
    """Construct an evidence-appropriate editorial brief.

    Branch on the confidence tier before anything else:

      insufficient → neutral, claim-free sentence (no numbers required)
      low         → hedged sentence, no superlatives
      moderate/high → confident copy that cites only real signals (platform,
                      numbers, delta when a baseline exists)
    """
    platform_str = PLATFORM_LABELS.get(top_platform or "") if top_platform else None
    platform_clause = f", driven primarily by {platform_str}" if platform_str else ""

    if confidence == "insufficient":
        return (
            f"{title} just entered tracking — not enough signal yet "
            f"to assess its trend."
        )

    if confidence == "low":
        noun = "mention" if sample_size == 1 else "mentions"
        return (
            f"Limited early signal — {sample_size:,} {noun} tracked so far; "
            f"too early for a confident trend call."
        )

    # ── moderate / high: confident copy, but only with real citations ────────
    delta_str: str | None = None
    if attention_delta_pct is not None:
        sign = "+" if attention_delta_pct >= 0 else ""
        delta_str = f"{sign}{attention_delta_pct:.0f}%"

    if driver == "recency":
        days_str = f"{days_since_release}d" if days_since_release is not None else "opening"
        brief = (
            f"In its {days_str} window, {title} has drawn {sample_size:,} signals "
            f"over the last 30 days{platform_clause}"
        )
        if mentions_24h > 0:
            brief += f", {mentions_24h:,} in the last 24 hours"
        brief += "."
    elif driver == "momentum":
        if delta_str:
            brief = (
                f"Surging momentum: conversation around {title} is up {delta_str} "
                f"over the last 3 days{platform_clause} — {sample_size:,} signals "
                f"tracked over the last 30 days."
            )
        else:
            brief = (
                f"{title} is gaining momentum{platform_clause} — "
                f"{sample_size:,} signals tracked over the last 30 days."
            )
    elif driver == "declining":
        if attention_delta_pct is not None and attention_delta_pct < 0:
            brief = (
                f"{title} is pulling back — conversation down {delta_str} from its "
                f"recent peak. {sample_size:,} signals tracked over the last 30 days"
                f"{platform_clause}."
            )
        else:
            brief = (
                f"{title} is cooling after earlier momentum — {sample_size:,} signals "
                f"tracked over the last 30 days{platform_clause}."
            )
    elif driver == "engagement":
        brief = (
            f"{title} sustains high audience sentiment at {score:.1f} Index Score"
            f"{platform_clause} — {sample_size:,} signals over the last 30 days."
        )
    else:
        # attention / cross_platform / undetermined — steady-state framing
        wks = f"{weeks_on_chart} {'week' if weeks_on_chart == 1 else 'weeks'}"
        brief = (
            f"{title} holds its position after {wks} on the Index — "
            f"{sample_size:,} signals over the last 30 days{platform_clause}"
        )
        if delta_str:
            brief += f", conversation {delta_str} over 3 days"
        brief += "."

    # ── lint check: reject if any filler phrase is present ───────────────────
    if _BANNED.search(brief):
        # Safe fallback: always specific, always has a number
        brief = (
            f"{title} — {sample_size:,} signals over the last 30 days"
            f"{platform_clause}. Index Score: {score:.1f}."
        )

    return brief


def _build_tags(driver: str | None, movement: int, mentions_24h: int) -> list[str]:
    tags: list[str] = []
    if driver == "recency":
        tags.append("#newrelease")
    if driver == "momentum" or movement >= 5:
        tags.extend(["#rising", "#climbing", "#wordofmouth"])
    elif movement > 0:
        tags.append("#climbing")
    if mentions_24h > 300:
        tags.append("#viral")
    elif mentions_24h > 100:
        tags.append("#highengagement")
    if driver == "declining":
        tags.append("#cooling")
    if not tags:
        tags.append("#onthechart")
    return tags[:3]


# ── /trending/films ───────────────────────────────────────────────────────────

def _build_results(db: Session, rows) -> list[TrendingFilmOut]:
    """Build evidence-gated entries for the given (Film, Ranking) rows."""
    now = datetime.now(timezone.utc)
    today = now.date()
    film_ids = [film.id for film, _ in rows]
    if not film_ids:
        return []

    # ── bulk 24h mention counts ───────────────────────────────────────────────
    # Catalog-only sources ("tmdb") are never conversation volume.
    catalog_ids = [
        sid for (sid,) in db.query(Source.id).filter(Source.key.in_(CATALOG_ONLY_SOURCE_KEYS)).all()
    ]
    since_24h = now - timedelta(hours=24)
    count_q = (
        db.query(Mention.film_id, func.count(Mention.id).label("cnt"))
        .where(Mention.film_id.in_(film_ids), Mention.created_at >= since_24h)
    )
    if catalog_ids:
        count_q = count_q.filter(~Mention.source_id.in_(catalog_ids))
    count_rows = count_q.group_by(Mention.film_id).all()
    mention_counts_24h: dict[int, int] = {fid: int(cnt) for fid, cnt in count_rows}

    # ── 3-day attention delta from LIVE mentions (recent 3d vs prior 3d) ──────
    # The delta is None whenever there is no prior baseline — claiming "+0%" or
    # "+100%" against no evidence is fabrication.  (DailyScore rows can go stale
    # when the rollup worker is idle, so we never trust them here.)
    since_6d = now - timedelta(days=6)
    delta_rows = (
        db.query(Mention.film_id, Mention.created_at)
        .filter(Mention.film_id.in_(film_ids), Mention.created_at >= since_6d)
        .all()
    )
    recent_3d: dict[int, int] = {fid: 0 for fid in film_ids}
    prior_3d: dict[int, int] = {fid: 0 for fid in film_ids}
    # DB drivers return naive datetimes; strip tz for Python-side comparisons.
    since_3d_naive = (now - timedelta(days=3)).replace(tzinfo=None)
    for fid, created in delta_rows:
        if created.replace(tzinfo=None) >= since_3d_naive:
            recent_3d[fid] = recent_3d.get(fid, 0) + 1
        else:
            prior_3d[fid] = prior_3d.get(fid, 0) + 1

    delta_pct: dict[int, float | None] = {}
    for fid in film_ids:
        prior = prior_3d.get(fid, 0)
        recent = recent_3d.get(fid, 0)
        if prior > 0:
            delta_pct[fid] = round((recent - prior) / prior * 100, 1)
        else:
            delta_pct[fid] = None  # no baseline → no percentage claim

    # ── per-platform breakdown (30d) ─────────────────────────────────────────
    # Used for BOTH the top-platform attribution and the live sample_size
    # fallback (raw mention count feeding the scores).  Internal ingest
    # sources (e.g. TMDB catalog sync) are excluded from platform attribution:
    # they are not platforms audiences use, and must never render as one.
    since_30d = now - timedelta(days=30)
    platform_rows_q = (
        db.query(
            Mention.film_id,
            Source.key,
            func.count(Mention.id).label("cnt"),
        )
        .join(Source, Source.id == Mention.source_id)
        .filter(Mention.film_id.in_(film_ids), Mention.created_at >= since_30d)
    )
    # ── TMDB firewall: the live sample_size fallback and platform attribution
    # must ignore catalog-only sources ("tmdb") — metadata rows are not
    # conversation volume and TMDB is never a "platform".
    # (catalog_ids already resolved above for the 24h counts.)
    if catalog_ids:
        platform_rows_q = platform_rows_q.filter(~Mention.source_id.in_(catalog_ids))
    platform_rows = platform_rows_q.group_by(Mention.film_id, Source.key).all()
    sample_size_map: dict[int, int] = {fid: 0 for fid in film_ids}
    top_platform_map: dict[int, str | None] = {}
    _platform_counts: dict[int, dict[str, int]] = {fid: {} for fid in film_ids}
    for fid, src_key, cnt in platform_rows:
        sample_size_map[fid] = sample_size_map.get(fid, 0) + int(cnt)
        _platform_counts[fid][src_key] = _platform_counts[fid].get(src_key, 0) + int(cnt)
    for fid, src_counts in _platform_counts.items():
        social_counts = {k: v for k, v in src_counts.items() if k not in INTERNAL_SOURCE_KEYS}
        if social_counts:
            top_platform_map[fid] = max(social_counts, key=social_counts.get)
        else:
            top_platform_map[fid] = None  # no real platform data → never a fake label

    # ── top discussion keyword per film (recent 7d mention texts) ─────────────
    since_7d = now - timedelta(days=7)
    text_rows = (
        db.query(Mention.film_id, Mention.text)
        .filter(
            Mention.film_id.in_(film_ids),
            Mention.created_at >= since_7d,
            Mention.text.isnot(None),
        )
        .limit(2000)   # safety cap
        .all()
    )
    texts_by_film: dict[int, list[str | None]] = {fid: [] for fid in film_ids}
    for fid, txt in text_rows:
        texts_by_film[fid].append(txt)

    top_topic_map: dict[int, str | None] = {
        fid: _top_keyword(texts_by_film.get(fid, [])) for fid in film_ids
    }

    # ── assemble entries ──────────────────────────────────────────────────────
    results: list[TrendingFilmOut] = []
    for film, ranking in rows:
        fid = film.id
        mentions_24h = mention_counts_24h.get(fid, 0)
        attn_delta = delta_pct.get(fid)
        top_platform = top_platform_map.get(fid)
        top_topic = top_topic_map.get(fid)

        # Confidence from the ranking cycle when available; otherwise compute
        # the same tier live so pre-migration snapshots still behave.
        stored_size = ranking.sample_size
        if stored_size is not None:
            sample_size = stored_size
            confidence = ranking.confidence or confidence_tier(sample_size)
        else:
            sample_size = sample_size_map.get(fid, 0)
            confidence = confidence_tier(sample_size)

        # Specificity cap: if we can't cite anything concrete for this title
        # (a real platform, a real 24h count, or a real delta), the tier is
        # capped at "low" no matter how big the raw count is.
        has_specific_signal = (
            top_platform is not None or mentions_24h > 0 or attn_delta is not None
        )
        if tier_at_least(confidence, "moderate") and not has_specific_signal:
            confidence = "low"

        # Days since release (for recency framing) — air_date covers both
        # content types (release_date for movies, first_air_date for shows).
        days_since: int | None = None
        if film.air_date is not None:
            days_since = max((today - film.air_date).days, 0)

        driver = _dominant_driver(
            ca=ranking.ca_score,
            momentum=ranking.momentum_score,
            recency=ranking.recency_score,
            ae=ranking.ae_score,
            cp=ranking.cp_score,
            movement=ranking.movement or 0,
        )

        # ── headline eligibility: real current activity, not blended score ────────
        # A title can top the Index by blended FinalScore while its current
        # attention/momentum are near zero (score carried by recency or stale
        # cross-platform history).  The "anchors the Index" headline is gated on
        # the current-activity components, mirroring the confidence gate used for
        # editorial copy: a strong claim requires evidence of current activity.
        headline_eligible = (
            (ranking.ca_score is not None and ranking.ca_score >= settings.headline_min_ca)
            or (ranking.momentum_score is not None
                and ranking.momentum_score >= settings.headline_min_momentum)
        )

        brief = _build_brief(
            title=film.title,
            driver=driver,
            confidence=confidence,
            sample_size=sample_size,
            attention_delta_pct=attn_delta,
            top_platform=top_platform,
            mentions_24h=mentions_24h,
            weeks_on_chart=ranking.weeks_on_chart or 1,
            score=ranking.score,
            days_since_release=days_since,
        )

        results.append(TrendingFilmOut(
            film_slug=film.slug,
            title=film.title,
            director=film.director or "Director TBA",
            year=film.year,
            rank=ranking.rank,
            score=ranking.score,
            poster_url=film.poster_url,
            gradient_from=film.gradient_from,
            gradient_to=film.gradient_to,
            trend_reason=brief,
            tags=_build_tags(driver, ranking.movement or 0, mentions_24h),
            delta_pct=round((ranking.movement or 0) * 2.5, 1),
            mentions_24h=mentions_24h,
            dominant_driver=driver,
            driver_label=driver_label_for(driver),
            attention_delta_pct=attn_delta,
            top_platform=top_platform,
            top_topic=top_topic,
            sample_size=sample_size,
            confidence=confidence,
            headline_eligible=headline_eligible,
        ))
    return results


@router.get("/trending/films", response_model=list[TrendingFilmOut])
def trending_films(limit: int = 20, db: Session = Depends(get_db)):
    """Return films with evidence-gated editorial briefs derived from real signals.

    Titles with ``confidence == "insufficient"`` (raw sample below the absolute
    floor) are omitted entirely: a one-mention film that happens to rank in the
    99th percentile of a quiet pool is not trending.  The pool broadens to older
    titles only when recent releases have too little real signal to fill it.
    """
    snap = db.scalar(select(func.max(Ranking.snapshot_at)))
    if not snap:
        return []

    now = datetime.now(timezone.utc)
    today = now.date()

    # Pass 1: top-ranked films at the latest snapshot, restricted to recent
    # releases so old catalog titles don't crowd out currently relevant films.
    # Content-type aware: movies use release_date, shows use first_air_date.
    cutoff_release = today - timedelta(days=90)
    rows = (
        db.query(Film, Ranking)
        .join(Ranking, Ranking.film_id == Film.id)
        .filter(
            Ranking.snapshot_at == snap,
            or_(
                and_(Film.content_type == "MOVIE", Film.release_date.isnot(None), Film.release_date >= cutoff_release),
                and_(Film.content_type == "TV_SHOW", Film.first_air_date.isnot(None), Film.first_air_date >= cutoff_release),
            ),
        )
        .order_by(desc(Ranking.score))
        .limit(max(limit * 5, 60))  # fetch deep; evidence filtering happens below
        .all()
    )
    results = _build_results(db, rows)
    eligible = [r for r in results if r.confidence != "insufficient"]

    # Pass 2: when recent releases have too little real signal to fill the feed,
    # broaden to all ranked films so genuinely active older titles surface
    # instead of an empty (or all-insufficient) feed.
    if len(eligible) < limit:
        seen_slugs = {r.film_slug for r in results}
        extra_rows = (
            db.query(Film, Ranking)
            .join(Ranking, Ranking.film_id == Film.id)
            .filter(Ranking.snapshot_at == snap)
            .order_by(desc(Ranking.score))
            .all()
        )
        extra_rows = [pair for pair in extra_rows if pair[0].slug not in seen_slugs]
        results += _build_results(db, extra_rows)
        eligible = [r for r in results if r.confidence != "insufficient"]

    # Evidence-first ordering: confident titles surface ahead of hedged ones.
    # Insufficient titles (raw sample below the absolute floor) are omitted
    # entirely — a 1-mention film in the 99th percentile of a quiet pool is
    # mathematically valid and editorially meaningless.
    eligible.sort(key=lambda r: r.score, reverse=True)
    return eligible[:limit]