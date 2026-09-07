import type { RankedFilm } from "./apiClient";
import { isNewRelease } from "./filmUtils";

export type Trend = "new" | "rise" | "steady" | "fall";

/**
 * Classify a film's chart trend from its snapshot data.
 *
 *  new     — no previous snapshot (first appearance)
 *  rise    — moved up at least one position
 *  fall    — moved down at least one position
 *  steady  — held the same rank
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
