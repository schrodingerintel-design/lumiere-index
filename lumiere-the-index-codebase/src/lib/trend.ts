import type { RankedFilm } from "./apiClient";
import { isNewRelease } from "./filmUtils";

export type Trend = "new" | "rise" | "steady" | "fall";

/**
 * Classify a film's chart trend from its snapshot data.
 *
 *  new     — no previous rank at all (first appearance)
 *  rise    — last rank change was upward (persistent until the next change)
 *  fall    — last rank change was downward (persistent until the next change)
 *  steady  — rank has never changed since charting
 *
 * The backend carries movement forward across snapshots, so a film that rose
 * 3 positions and then held its new rank keeps showing "↑ 3" until its rank
 * changes again — the indicator reflects the last real movement, not the
 * snapshot-to-snapshot delta.
 */
export function filmTrend(film: RankedFilm | null | undefined): Trend {
  if (!film) return "steady";
  if (film.prev_rank == null) {
    return isNewRelease(film) ? "new" : "steady";
  }
  const move = film.movement ?? 0;
  if (move > 0) return "rise";
  if (move < 0) return "fall";
  return "steady";
}

/** Arrow icon name per trend — callers map to their own icon components. */
export const TREND_LABEL: Record<Trend, string> = {
  new: "New",
  rise: "Rising",
  steady: "Steady",
  fall: "Falling",
};
