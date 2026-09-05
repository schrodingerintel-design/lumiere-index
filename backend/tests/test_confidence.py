"""Unit tests for the shared confidence-tier / driver-label / platform helpers."""
from app.services.confidence import (
    confidence_tier,
    driver_label,
    tier_at_least,
    PLATFORM_LABELS,
    INTERNAL_SOURCE_KEYS,
)


def test_confidence_tier_thresholds():
    assert confidence_tier(0) == "insufficient"
    assert confidence_tier(1) == "insufficient"   # the acceptance-case floor
    assert confidence_tier(4) == "insufficient"
    assert confidence_tier(5) == "low"
    assert confidence_tier(24) == "low"
    assert confidence_tier(25) == "moderate"
    assert confidence_tier(99) == "moderate"
    assert confidence_tier(100) == "high"
    assert confidence_tier(1500) == "high"


def test_tier_at_least():
    assert tier_at_least("high", "moderate")
    assert tier_at_least("moderate", "moderate")
    assert not tier_at_least("low", "moderate")
    assert not tier_at_least("insufficient", "low")
    assert tier_at_least("low", "insufficient")


def test_driver_label_never_metric_name():
    """Labels must name an actual component, never the metric's own name."""
    assert driver_label("attention") == "Sustained Attention"   # CA-driven
    assert driver_label("momentum") == "Momentum Surge"          # M-driven
    assert driver_label("recency") == "New Release Window"       # R-driven
    assert driver_label("engagement") == "Audience Engagement"   # AE-driven
    assert driver_label("cross_platform") == "Cross-Platform Reach"
    assert driver_label("declining") == "Momentum Cooling"
    assert driver_label(None) is None
    assert "attention" != driver_label("attention").lower()  # not the raw key


def test_platform_labels_are_real_external_platforms():
    assert PLATFORM_LABELS["reddit"] == "Reddit"
    assert PLATFORM_LABELS["letterboxd"] == "Letterboxd"
    assert PLATFORM_LABELS["tiktok"] == "TikTok"
    # Internal ingest sources are never real platforms
    assert "tmdb" not in PLATFORM_LABELS
    assert "audience" not in PLATFORM_LABELS
    assert "tmdb" in INTERNAL_SOURCE_KEYS
    assert "audience" in INTERNAL_SOURCE_KEYS