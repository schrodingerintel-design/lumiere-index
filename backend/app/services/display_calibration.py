"""Beta-era display calibration for the Index Score.

The absolute attention map (100·log10(1+A)/log10(1+A_ref)) measures real
attention. During the public beta, signal volume is far below launch-normal
(one live source, chunk-relative Trends data), so the raw map renders the
chart in a low band: the chunk ceiling saturates at 100 and the tail sits
near 4–10.

BETA_DISPLAY_CALIBRATION stretches that map onto the presentation band the
beta chart is designed around — the strongest measured attention reads ≈ 98.5
and a chart-bottom title ≈ 26 — while preserving every real gap. The stretch
is a FIXED monotone transform of the absolute score:

    display = floor + (ceiling − floor) · raw/100

so ties stay ties, attention differences stay proportional, and nothing is
assigned by rank. Two titles with identical attention display identically;
a title with 2× the attention of another is always higher.

Reversal at normal launch: set `beta_display_calibration=false` (env
`BETA_DISPLAY_CALIBRATION`) and the raw absolute map returns untouched.
`Ranking.attention_raw` persists the true intensity either way, so history
stays recalibratable.
"""
from app.config import settings


def beta_display_score(raw: float) -> float:
    """Stretch an absolute-map score into the beta presentation band.

    Identity when the calibration is off or the input is the zero/unranked
    sentinel. Output is clamped to [0, ceiling] — it can never exceed the
    ceiling, no matter how the raw map behaves with rank.
    """
    if not settings.beta_display_calibration:
        return raw
    if raw <= 0.0:
        return 0.0
    floor = settings.beta_display_floor
    ceiling = settings.beta_display_ceiling
    return round(min(ceiling, floor + (ceiling - floor) * (raw / 100.0)), 2)
