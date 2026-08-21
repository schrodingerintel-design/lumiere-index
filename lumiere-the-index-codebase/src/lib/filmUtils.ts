import type { RankedFilm } from "./apiClient";

/**
 * Returns true if the film's release_date is within `days` days of today
 * (before or after). Used to gate the "New Release" badge.
 */
export function isNewRelease(film: RankedFilm | null, days: number = 7): boolean {
  if (!film?.release_date) return false;
  const release = new Date(film.release_date);
  const now = new Date();
  const diffMs = now.getTime() - release.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // Released within the past `days` days, or releasing within the next `days` days
  return diffDays >= -days && diffDays <= days;
}
