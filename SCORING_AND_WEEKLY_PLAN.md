# The Index — Score Recalibration & Weekly Top 100 Plan

Status: analysis complete, implementation ready. This document is the working
plan for the four-part update (15-minute labeling / Weekly Top 100 / copy pass /
score audit). Written after reading the full pipeline and pulling live
production data.

## 1. Score compression — root cause (verified against production)

Live Movie 100 (pulled from `/films/top`, 2026-09-21):

| rank | title | score | sample_size |
|---|---|---|---|
| 1 | A Complete Cloud | 96.10 | 7 |
| 2 | Avatar | 96.09 | 10 |
| 10 | Heart of the Beast | 95.82 | 14 |
| 50 | (mid-chart) | ≈ 94.3 | ≈ 12 |
| 100 | The Invite | 93.18 | 14 |

Spread #1 → #100: **2.92 points**. sample_size median is 12, p90 is 34.

The mechanism, from `app/services/ranking.py` §8:

```
score = 100 · (1 − exp(−3 · composite / p95))
```

where `p95` is the 95th percentile of the current pool's composites.

**This map is structurally rank-relative, not attention-relative:**

- `composite == p95` → score = `100·(1−e⁻³)` = **95.02, always**, no matter how
  much attention exists in the world. The 95th-percentile title is pinned to
  95.02 every cycle.
- A quiet week and a blockbuster week produce identical scores for the same
  rank structure, because the anchor moves with the pool.
- Inverting the observed values: #1's 96.10 ↔ `composite/p95 = 1.081`;
  #100's 93.18 ↔ 0.896. The entire chart lives in a 20% band around p95, and
  the exponential flattens there — a 20% relative spread renders as 2.9 points.

**Why the composite itself is tight** (secondary contributors, same file):

- CA/M/AE go through `_robust_sig` (median/MAD sigmoid, slope 0.9). In a
  low-volume pool (log1p mention differences of ~0.2–0.5) the sigmoid outputs
  cluster near 0.5.
- CP uses discrete `_percentile_rank`; the YouTube blends use min/max
  `_norm_pool`. Small pools quantize both.
- R (weight 0.20) saturates: any title mentioned today has R = 1.0, so it adds
  a near-constant to the top of the chart.
- AE defaults to 0.5 (neutral) for titles below `ranking_min_tracked_days` of
  sentiment — another constant in a sparse pool.

Conclusion: **displayed scores measure pool position, not attention.** The
product requirement ("a 96.1 must mean something historically"; "95–100 =
exceptional") cannot be met by any relative anchor.

## 2. Score fix — absolute attention calibration

Design constraint: ranking order stays exactly as the existing composite model
produces it (§8 ordering is unchanged). Only the displayed Index Score mapping
changes, plus one persisted audit column.

**Absolute attention intensity per title** (computed in the same recompute
loop, from data already loaded):

```
A(f) = Σ_d mentions(d)·λ^age(d) / Σ_d λ^age(d)     (decay-weighted mentions/day)
       + view_velocity / K                          (YouTube, when present)
```

`K = score_youtube_views_per_mention` (config, default 2500) calibrates video
views into mention-equivalents. A is an absolute count of measured attention —
it does not depend on what other titles are doing.

**Absolute score map** (replaces the p95 exponential):

```
score = 100 · log10(1 + A) / log10(1 + A_ref),  clamped to [0, 100]
```

`A_ref = score_attention_ref` (config, default 250 decayed mentions/day ≈
"discussed ~250×/day across tracked platforms" = exceptional). Properties:

- A = 0 → 0; A = A_ref → exactly 100 (technically achievable, rare — matches
  the current p95 semantics of "exceptional" but on absolute ground).
- Each decade of attention adds ~41.6 points — differences are preserved, no
  saturation below 100.
- Quiet week: top title A≈25 → #1 ≈ 78; marginal #100 A≈3 → ≈ 25. Blockbuster
  week: top A≈180 → #1 ≈ 95. The chart breathes with real attention, which is
  the product requirement.
- Candidate examples from the brief reproduce naturally: #1 96.1 / #10 81.3 /
  #100 32.8 correspond to A ≈ 270 / 46 / 6.5.

**Monotone presentation rule:** displayed scores must not increase down a chart
(rank is by composite; A and composite are correlated but not identical). 
`score(i) = min(score(i−1), absolute_map(A_i))` — a rare, small cap where a
lower-ranked title measured fractionally more raw attention; documented in
methodology.

**Persistence/audit:** new nullable `Ranking.attention_raw` column (float, the
computed A). `startup_schema` backfills columns automatically on boot; no
hand-written migration needed.

**Weekly publication** (`index_publication.publish_weekly_index`) switches to
the same absolute map with `A_week = total_signal_volume / 7` (avg daily
mentions in the window). The per-chart weekly scores, debuts, and movers keep
their semantics.

**Tests** (new `test_score_calibration.py` + additions to `test_ranking.py` /
`test_index_publication.py`):

1. Compression guard: a pool whose top title has 50× the bottom title's volume
   must render a spread > 25 points (the current code fails this: 2.92).
2. Volume sensitivity: scaling every title's signals 10× must move #1's score
   up by a large margin (the p95 map is invariant; the absolute map is not).
3. `A == A_ref → 100.0`; `A == A_ref/2 → ≈ 79.2`; clamp at 100; floor at 0.
4. Scores non-increasing down each published chart.
5. Identical displayed scores only for identical attention inputs.
6. Weekly rows use the absolute map (regression against the p95 map).

## 3. Weekly Top 100 — combined chart

**Storage:** reuse `weekly_index_snapshots` with `chart_type = "WEEKLY_100"`
(10 chars, fits `String(16)`; existing unique constraints already give
idempotent, immutable, per-week publication; retention never prunes this
table, so archives accumulate forever). No migration.

**Chart law:** rank is contextual to WEEKLY_100; movies and TV compete on one
chart, each row labeled by `film.content_type` (already serialized by
`WeeklyEntryOut`); only positions 1–100 are ever written.

**Calculation** (rewards sustained performance, explicitly not the final
ranking of the week) — per title over the ISO week window:

```
weekly composite =
    0.40 · attention_volume_norm      avg decayed daily mentions in window
    0.25 · consistency                share of the 7 days ranked in a Top 100
    0.20 · rank_quality               mean of (1 − (r_d−1)/99) over days present
    0.10 · sentiment                  avg (sentiment+1)/2
    0.05 · coverage                   distinct sources (capped 7) / 7
```

Rank quality averaged across days is the spike-punisher: a title sitting at
#5–#8 all week (quality ≈ 0.94) beats a title that touches #1 on Tuesday and
falls out (quality collapses with the missing days). Consistency adds a hard
attendance reward. Weekly score displayed via the absolute map
(`A_week = avg daily mentions`) so weekly numbers share meaning with daily
numbers.

**Plumbing:**

- `publish_weekly_index` computes and writes the two existing per-chart
  weeklies plus the combined WEEKLY_100 in one pass (same loaded aggregates —
  cheap; keeps the existing `/index/weekly?chart=` contract intact).
- Scheduler already runs it every 6h; publication is idempotent per
  (chart_type, week), and only completed weeks get published rows.
- Validation: the weekly post-write checks must allow mixed content types for
  WEEKLY_100 while keeping the per-chart entity-type rule.
- API: `normalize_chart` accepts `WEEKLY_100` / `weekly`; the existing
  `GET /api/v1/index/weekly` endpoint serves it (history via `?week_start=`).
- Frontend: new `/weekly-100` route (same table language as top-100, with a
  Movie/TV chip per row), nav + footer links, homepage section,
  `getWeeklyTop100()` in `apiClient.ts`.

## 4. Copy pass (mechanical, meaning-preserving)

- Em dashes: remove across all frontend copy (~35 files). Replace per sentence
  with ",", ":" or "." — never by blind character substitution.
- Chart descriptions (exact copy from the brief):
  - Top 100 Movies — "The movies getting the most attention right now."
  - Top 100 TV Shows — "The TV shows getting the most attention right now."
  - Weekly Top 100 — "The movies and TV shows that performed best throughout
    the week."
- "Daily" labeling: Footer "published daily" → "Updated every 15 minutes";
  `top-100.tsx` header "· Daily ·" → "Updated every 15 minutes";
  `__root.tsx` meta description; `rising.tsx` intro; `new-entries.tsx` hint.
- Methodology: keep technical precision (allowed), remove em dashes, add the
  Index Score band table (95+ exceptional … 0–24.9 minimal) and the
  rank-vs-score distinction.
- Legal pages: em dashes only; no meaning changes.

## 5. Beta 1.2.1

`src/lib/beta.ts`: bump `BETA_VERSION` to "1.2.1" and prepend the release
entry (score recalibration, Weekly Top 100, copy pass, 15-minute labeling).
The popup, badge, and About changelog all read from the registry already.

## 6. Sequencing

1. Score calibration backend + tests (ranking.py, config, publication map).
2. WEEKLY_100 publication + API + validation.
3. Frontend weekly page + nav + api client.
4. Copy pass (em dashes, chart descriptions, 15-minute labels, methodology).
5. Beta 1.2.1 registry bump.
6. Verify: backend pytest, frontend tsc + vitest, push, CI, live checks
   (score spread > 25 pts on a synthetic check / real spread after recompute,
   `/index/weekly` returns the combined chart, weekly page renders).
