"""Confidence tiers for editorial claims — the shared gate every consumer uses.

A raw sample size (mention/signal count feeding the ranking components,
pre-normalization) is the only absolute floor.  Percentile rank is relative to
a possibly-quiet pool, so a title can rank 99th percentile with one mention;
that is mathematically valid and editorially meaningless.  Every claim-bearing
surface (editorial brief, headline, score badge, platform attribution) must
branch on the tier derived here before rendering a confident statement.
"""

from app.config import settings

# Tier names, weakest → strongest.  Ordered so comparisons like
# `TIER_ORDER[tier] >= TIER_ORDER["high"]` work.
TIERS = ("insufficient", "low", "moderate", "high")
_TIER_ORDER = {t: i for i, t in enumerate(TIERS)}


def confidence_tier(sample_size: int) -> str:
    """Absolute-confidence tier from the raw signal count, ignoring rank.

    ``sample_size`` is the raw mention/signal count that fed the per-component
    scores (pre-normalization) for this title in this ranking cycle.
    """
    if sample_size < settings.confidence_low_threshold:
        return "insufficient"
    if sample_size < settings.confidence_medium_threshold:
        return "low"
    if sample_size < settings.confidence_high_threshold:
        return "moderate"
    return "high"


def tier_at_least(tier: str, minimum: str) -> bool:
    """True when ``tier`` is at least as strong as ``minimum``."""
    return _TIER_ORDER.get(tier, 0) >= _TIER_ORDER.get(minimum, 0)


# ── driver labels ────────────────────────────────────────────────────────────
# Display names for the dominant score component.  These always name an actual
# component (CA / M / R / AE / CP) — never the metric's own name ("attention"),
# which is circular.
DRIVER_LABELS: dict[str, str] = {
    "recency": "New Release Window",     # R — linear recency decay
    "momentum": "Momentum Surge",        # M — EWMA short − long
    "declining": "Momentum Cooling",     # M — negative momentum
    "engagement": "Audience Engagement", # AE — sentiment EWMA
    "attention": "Sustained Attention",  # CA — recency-weighted mention average
    "cross_platform": "Cross-Platform Reach",  # CP — distinct active sources
}


def driver_label(driver: str | None) -> str | None:
    """Return the display label for a driver key, or None when there is none."""
    if not driver:
        return None
    return DRIVER_LABELS.get(driver)


# ── platform attribution ─────────────────────────────────────────────────────
# Only real external platforms may appear in "Top platform" fields.  Internal
# ingest sources (e.g. the TMDB catalog sync) are not platforms audiences use.
INTERNAL_SOURCE_KEYS = frozenset({"tmdb", "audience"})

# ── TMDB firewall ────────────────────────────────────────────────────────────
# TMDB is a catalog/metadata provider, NOT a cultural signal.  Its key lives
# here so every aggregation surface (ranking components, weekly aggregates,
# source coverage, sentiment splits, the signal funnel) applies the same
# exclusion — TMDB rows must never influence the Index Score, movers, debuts,
# or any public metric.
CATALOG_ONLY_SOURCE_KEYS = frozenset({"tmdb"})

PLATFORM_LABELS: dict[str, str] = {
    "reddit": "Reddit",
    "news": "news outlets",
    "youtube": "YouTube",
    "tiktok": "TikTok",
    "wikipedia": "Wikipedia",
    "trends": "Google Trends",
    "letterboxd": "Letterboxd",
}

NOT_ENOUGH_PLATFORM_COPY = "Not enough platform data yet"