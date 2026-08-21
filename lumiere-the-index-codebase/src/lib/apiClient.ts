/**
 * Lumière API Client
 * Provides typed fetch wrappers for:
 *  1. Local FastAPI backend  (VITE_API_BASE_URL)
 *  2. TMDB via backend proxy (key never exposed to browser)
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://localhost:8000";
export const TMDB_IMG = "https://image.tmdb.org/t/p";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Backend Types ────────────────────────────────────────────────────────────

export interface RankedFilm {
  id: number;
  slug: string;
  title: string;
  director: string | null;
  year: number | null;
  country_origin: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  synopsis: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  release_date: string | null;
  rank: number;
  score: number;
  prev_rank: number | null;
  movement: number | null;
  peak_rank: number | null;
  weeks_on_chart: number | null;
  mentions_total: number;
  is_fallback?: boolean;
}

export interface SentimentBreakdown {
  positive: number | null;
  neutral: number | null;
  negative: number | null;
  sufficient_data: boolean;
}

export interface FilmDetail extends RankedFilm {
  sentiment: SentimentBreakdown;
}

export interface TimelinePoint {
  day: string;
  mentions: number;
  score: number;
}

export interface CountryScoreOut {
  country_code: string;
  mentions: number;
  score: number;
}

export interface TrendingTopicOut {
  topic: string;
  slug: string;
  score: number;
  delta_pct: number;
}

/** Film-centric trending entry returned by /api/v1/trending/films */
export interface TrendingFilmOut {
  film_slug: string;
  title: string;
  director: string | null;
  year: number | null;
  rank: number;
  score: number;
  poster_url: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  trend_reason: string;
  tags: string[];
  delta_pct: number;
  mentions_24h: number;
}

export interface RefreshMeta {
  snapshot_at: string | null;
  next_refresh_at: string;
  interval_minutes: number;
}

export interface LiveStats {
  total_mentions_24h: number;
  tracked_films: number;
  active_countries: number;
  snapshot_at: string;
}

// ─── TMDB Types ───────────────────────────────────────────────────────────────

export interface TmdbMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  overview: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}

export interface TmdbSearchResult {
  results: TmdbMovie[];
}

// ─── Backend API ──────────────────────────────────────────────────────────────

export const getTopFilms = (limit: number = 10, offset: number = 0) =>
  apiFetch<RankedFilm[]>(`/api/v1/films/top?limit=${limit}&offset=${offset}`);

/** Recently released films, highest index score first (home page + Top 100). */
export const getNewReleaseFilms = (limit: number = 100, offset: number = 0) =>
  apiFetch<RankedFilm[]>(
    `/api/v1/films/new-releases?limit=${limit}&offset=${offset}&year_window=2`,
  );

export const getRisingFilms = (limit: number = 10, offset: number = 0) =>
  apiFetch<RankedFilm[]>(`/api/v1/films/rising?limit=${limit}&offset=${offset}`);

export const getNewEntries = (limit: number = 100, offset: number = 0) =>
  apiFetch<RankedFilm[]>(`/api/v1/films/new-entries?limit=${limit}&offset=${offset}`);

export const getFilmDetail = (slug: string) => apiFetch<FilmDetail>(`/api/v1/films/${slug}`);

export const searchFilms = (q: string, limit: number = 20) =>
  apiFetch<RankedFilm[]>(`/api/v1/films/search?q=${encodeURIComponent(q)}&limit=${limit}`);

export const getFilmTimeline = (slug: string, days: number = 30) =>
  apiFetch<TimelinePoint[]>(`/api/v1/films/${slug}/timeline?days=${days}`);

export const getTrendingTopics = () => apiFetch<TrendingTopicOut[]>("/api/v1/trending/topics");

/** Fetch films trending by audience engagement velocity. */
export const getTrendingFilms = (limit: number = 20) =>
  apiFetch<TrendingFilmOut[]>(`/api/v1/trending/films?limit=${limit}`);

export const getLiveStats = () => apiFetch<LiveStats>("/api/v1/stats/live");

export const getMetaRefresh = () => apiFetch<RefreshMeta>("/api/v1/meta/refresh");

export const subscribeNewsletter = (email: string) =>
  apiFetch<{ ok: boolean }>("/api/v1/newsletter/subscribe", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

// ─── TMDB via backend proxy ──────────────────────────────────────────────────

export const searchTmdbMovie = (title: string, year?: number) =>
  apiFetch<TmdbSearchResult>(
    `/api/v1/tmdb/search/movie?query=${encodeURIComponent(title)}${year ? `&year=${year}` : ""}`,
  );

export const getTmdbMovieVideos = (tmdbId: number) =>
  apiFetch<{ results: { key: string; site: string; type: string }[] }>(
    `/api/v1/tmdb/movie/${tmdbId}/videos`,
  );

export const getTmdbMovieDetails = (tmdbId: number) =>
  apiFetch<{
    budget: number;
    revenue: number;
    runtime: number;
    genres: { id: number; name: string }[];
    production_countries: { iso_3166_1: string; name: string }[];
    vote_average: number;
    vote_count: number;
    popularity: number;
  }>(`/api/v1/tmdb/movie/${tmdbId}`);

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface WatchProviderOptions {
  link?: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  free?: WatchProvider[];
  ads?: WatchProvider[];
}

export interface TmdbWatchProviders {
  id: number;
  results: Record<string, WatchProviderOptions>;
}

export const getTmdbWatchProviders = (tmdbId: number) =>
  apiFetch<TmdbWatchProviders>(`/api/v1/tmdb/movie/${tmdbId}/watch/providers`);

export const getTmdbUpcoming = (page: number = 1) =>
  apiFetch<{ results: TmdbMovie[] }>(`/api/v1/tmdb/movie/upcoming?page=${page}`);

export const getTmdbNowPlaying = (page: number = 1) =>
  apiFetch<{ results: TmdbMovie[] }>(`/api/v1/tmdb/movie/now_playing?page=${page}`);

export const discoverTmdbMovies = (params: {
  genres?: string;
  language?: string;
  sortBy?: string;
  page?: number;
}) => {
  const q = new URLSearchParams();
  if (params.genres) q.set("with_genres", params.genres);
  if (params.language) q.set("with_original_language", params.language);
  if (params.sortBy) q.set("sort_by", params.sortBy);
  if (params.page) q.set("page", String(params.page));
  return apiFetch<{ results: TmdbMovie[] }>(`/api/v1/tmdb/discover/movie?${q.toString()}`);
};

export const discoverTmdbTv = (params: { sortBy?: string; page?: number }) => {
  const q = new URLSearchParams();
  if (params.sortBy) q.set("sort_by", params.sortBy);
  if (params.page) q.set("page", String(params.page));
  return apiFetch<{ results: TmdbMovie[] }>(`/api/v1/tmdb/discover/tv?${q.toString()}`);
};

export const tmdbPosterUrl = (
  path: string | null | undefined,
  size: "w185" | "w342" | "w500" | "original" = "w500",
) => (path ? `${TMDB_IMG}/${size}${path}` : null);

export const tmdbBackdropUrl = (
  path: string | null | undefined,
  size: "w780" | "w1280" | "original" = "w1280",
) => (path ? `${TMDB_IMG}/${size}${path}` : null);
