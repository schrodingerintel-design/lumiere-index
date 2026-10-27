import { apiFetch, TMDB_IMG } from "./apiClient";
import culture from "@/data/culture.json";

export type ScreenType = "movie" | "tv";
export interface ScreenTitle {
  id: number;
  media_type?: ScreenType;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  character?: string;
  job?: string;
  popularity?: number;
  adult?: boolean;
}
export interface Person {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  known_for?: ScreenTitle[];
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  homepage?: string | null;
  combined_credits?: { cast: ScreenTitle[]; crew: ScreenTitle[] };
}
export interface CastMember extends Person {
  character?: string;
  job?: string;
  department?: string;
}
export interface ScreenDetail extends ScreenTitle {
  tagline?: string;
  status?: string;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { id: number; name: string }[];
  production_companies?: { id: number; name: string }[];
  spoken_languages?: { english_name: string; name: string }[];
  origin_country?: string[];
  budget?: number;
  revenue?: number;
  original_language?: string;
  credits?: { cast: CastMember[]; crew: CastMember[] };
  recommendations?: { results: ScreenTitle[] };
  videos?: {
    results: { key: string; site: string; type: string; name: string; official?: boolean }[];
  };
  created_by?: { id: number; name: string; profile_path: string | null }[];
  seasons?: {
    id: number;
    name: string;
    air_date?: string;
    episode_count: number;
    poster_path?: string | null;
    overview?: string;
  }[];
}
export interface CatalogPage<T> {
  results: T[];
  page: number;
  total_pages: number;
  total_results?: number;
}
export const getPeople = (window: "day" | "week" = "week", page = 1) =>
  apiFetch<CatalogPage<Person>>(`/api/v1/tmdb/trending/person/${window}?page=${page}`);
export const getPerson = (id: string) => apiFetch<Person>(`/api/v1/tmdb/person/${id}`);
export const getScreen = (type: ScreenType, id: string) =>
  apiFetch<ScreenDetail>(`/api/v1/tmdb/${type}/${id}`);
export const getCatalog = (type: ScreenType, collection = "trending", page = 1) =>
  apiFetch<CatalogPage<ScreenTitle>>(
    collection === "trending"
      ? `/api/v1/tmdb/trending/${type}/week?page=${page}`
      : `/api/v1/tmdb/catalog/${type}/${collection}?page=${page}`,
  );
export const searchCatalog = (query: string) =>
  apiFetch<CatalogPage<ScreenTitle | (Person & { media_type: "person" })>>(
    `/api/v1/tmdb/search/multi?query=${encodeURIComponent(query)}`,
  );
export const titleOf = (title: ScreenTitle) => title.title || title.name || "Untitled";
export const yearOf = (title: ScreenTitle) =>
  (title.release_date || title.first_air_date || "").slice(0, 4);
export const imageOf = (path?: string | null, size = "w500") =>
  path ? `${TMDB_IMG}/${size}${path}` : undefined;
export const safeExternal = (url?: string | null) => {
  try {
    const parsed = new URL(url || "");
    return parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
};
export type CultureEntry = (typeof culture)[number];
export const CULTURE = culture;
export const CULTURE_CATEGORIES = [
  {
    kind: "games",
    label: "Games",
    path: "/games",
    heading: "Worlds worth getting lost in",
    copy: "Explore games through their design, stories, and communities.",
  },
  {
    kind: "creators",
    label: "Creators",
    path: "/creators",
    heading: "People shaping what we watch",
    copy: "Video, comedy, technology, and the craft behind online culture.",
  },
  {
    kind: "music",
    label: "Music",
    path: "/music",
    heading: "More than the songs",
    copy: "Artists, performance, production, and the worlds around a record.",
  },
] as const;
export interface WikiProfile {
  extract: string | null;
  image_url: string | null;
  source_url: string;
  image_credit: string | null;
  image_license: string | null;
  image_source: string | null;
  stale?: boolean;
}
export const getCultureReference = (slug: string) =>
  apiFetch<WikiProfile>(`/api/v1/culture/wiki/${slug}`, undefined, 15000);
export const sourceOf = (entry: CultureEntry) => `https://en.wikipedia.org/wiki/${entry.wiki}`;
