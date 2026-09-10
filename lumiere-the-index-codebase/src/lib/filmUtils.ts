import type { RankedFilm } from "./apiClient";

/**
 * The date a title "aired" — release_date for movies, first_air_date for TV
 * shows. TV shows are first-class content; their date never lives in
 * release_date.
 */
export function airDate(film: Pick<RankedFilm, "content_type" | "release_date" | "first_air_date"> | null): string | null {
  if (!film) return null;
  if (film.content_type === "TV_SHOW") return film.first_air_date ?? null;
  return film.release_date ?? null;
}

/**
 * Returns true if the title's air date is within `days` days of today
 * (before or after). Used to gate the "New Release" badge.
 */
export function isNewRelease(film: RankedFilm | null, days: number = 7): boolean {
  const dateStr = airDate(film);
  if (!dateStr) return false;
  const release = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - release.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // Released within the past `days` days, or releasing within the next `days` days
  return diffDays >= -days && diffDays <= days;
}

/**
 * Chart tenure — days on the live Index, shown compactly ("1d", "12d") in
 * table rows. Days is the tenure unit: the chart refreshes every 15 minutes,
 * so weeks would be far too coarse.
 */
export function tenureDays(film: Pick<RankedFilm, "days_on_chart" | "weeks_on_chart"> | null): number {
  return film?.days_on_chart ?? 1;
}

export function tenureLabel(film: Pick<RankedFilm, "days_on_chart" | "weeks_on_chart"> | null): string {
  if (!film) return "1d";
  return `${tenureDays(film)}d`;
}
