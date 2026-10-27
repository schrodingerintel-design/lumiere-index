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
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { id: number; name: string }[];
  production_companies?: { id: number; name: string }[];
  spoken_languages?: { english_name: string; name: string }[];
  origin_country?: string[];
  production_countries?: { iso_3166_1: string; name: string }[];
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
export const getPeople = (window: "day" | "week" | "popular" = "week", page = 1) =>
  apiFetch<CatalogPage<Person>>(
    window === "popular"
      ? `/api/v1/tmdb/people/popular?page=${page}`
      : `/api/v1/tmdb/trending/person/${window}?page=${page}`,
    undefined,
    20000,
  );
export const getPerson = (id: string) => apiFetch<Person>(`/api/v1/tmdb/person/${id}`);
export const getScreen = (type: ScreenType, id: string) =>
  apiFetch<ScreenDetail>(`/api/v1/tmdb/${type}/${id}`);
export const getCatalog = (type: ScreenType, collection = "trending", page = 1) =>
  apiFetch<CatalogPage<ScreenTitle>>(
    collection === "trending"
      ? `/api/v1/tmdb/trending/${type}/week?page=${page}`
      : `/api/v1/tmdb/catalog/${type}/${collection}?page=${page}`,
  );
export const searchCatalog = (query: string, page = 1) =>
  apiFetch<CatalogPage<ScreenTitle | (Person & { media_type: "person" })>>(
    `/api/v1/tmdb/search/multi?query=${encodeURIComponent(query)}&page=${page}`,
    undefined,
    20000,
  );
export const titleOf = (title: ScreenTitle) => title.title || title.name || "Untitled";
export const yearOf = (title: ScreenTitle) =>
  (title.release_date || title.first_air_date || "").slice(0, 4);
export function mergeScreenCredits(credits: ScreenTitle[]): ScreenTitle[] {
  const merged = new Map<string, ScreenTitle>();
  const roles = (first?: string, next?: string) =>
    [...new Set([first, next].filter(Boolean))].join(" / ") || undefined;
  for (const credit of credits) {
    const key = `${credit.media_type}:${credit.id}`;
    const previous = merged.get(key);
    merged.set(
      key,
      previous
        ? {
            ...previous,
            ...credit,
            character: roles(previous.character, credit.character),
            job: roles(previous.job, credit.job),
          }
        : credit,
    );
  }
  return [...merged.values()];
}
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
    heading: "Games",
    copy: "Explore games through their design, stories, and communities.",
  },
  {
    kind: "creators",
    label: "Creators",
    path: "/creators",
    heading: "Creators",
    copy: "Video, comedy, technology, and the craft behind online culture.",
  },
  {
    kind: "music",
    label: "Music",
    path: "/music",
    heading: "Music",
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

export const CATALOG_MAX_PAGES = 500;
export const CATALOG_PAGE_SIZES = [20, 40, 60, 100] as const;
/** Fetch only the selected window; never download the entire catalog. */
export async function catalogWindow<T extends { id: number }>(
  fetchPage: (page: number) => Promise<CatalogPage<T>>,
  page: number,
  size: number,
): Promise<CatalogPage<T>> {
  if (!CATALOG_PAGE_SIZES.includes(size as 20 | 40 | 60 | 100))
    throw new Error("Unsupported page size");
  const width = size / 20;
  const start = (page - 1) * width + 1;
  if (!Number.isInteger(page) || page < 1 || start > CATALOG_MAX_PAGES)
    throw new Error("Page unavailable");
  const first = await fetchPage(start);
  const lastPage = Math.min(CATALOG_MAX_PAGES, Math.max(1, first.total_pages));
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.min(width - 1, lastPage - start)) }, (_, index) =>
      fetchPage(start + index + 1),
    ),
  );
  return {
    ...first,
    page,
    total_pages: Math.ceil(lastPage / width),
    results: [
      ...new Map(
        [first, ...rest].flatMap((result) => result.results).map((item) => [item.id, item]),
      ).values(),
    ],
  };
}
export const getCatalogWindow = (
  type: ScreenType,
  collection: string,
  page: number,
  size: number,
) => catalogWindow((sourcePage) => getCatalog(type, collection, sourcePage), page, size);
export const getPeopleWindow = (window: "day" | "week" | "popular", page: number, size: number) =>
  catalogWindow((sourcePage) => getPeople(window, sourcePage), page, size);
