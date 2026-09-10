import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getNewReleaseFilms, getTopFilms, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Bookmark, BookmarkX } from "lucide-react";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";
import { tenureLabel } from "@/lib/filmUtils";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "My Watchlist — Lumière The Index" },
      { name: "description", content: "Titles you're tracking across the Index." },
    ],
  }),
  component: WatchlistPage,
  errorComponent: RouteError,
});

function WatchlistPage() {
  const [savedSlugs, setSavedSlugs] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem("lumiere_watchlist") ?? "[]");
      setSavedSlugs(list);
    } catch {
      setSavedSlugs([]);
    }
    setIsLoaded(true);
  }, []);

  const removeSlug = (slug: string) => {
    const next = savedSlugs.filter((s) => s !== slug);
    setSavedSlugs(next);
    localStorage.setItem("lumiere_watchlist", JSON.stringify(next));
  };

  const clearAll = () => {
    setSavedSlugs([]);
    localStorage.removeItem("lumiere_watchlist");
  };

  // Fetch catalog films to resolve saved slugs
  const { data: topFilms = [], isLoading: topLoading } = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newReleases = [], isLoading: newLoading } = useQuery({
    queryKey: ["films", "new-releases", 100],
    queryFn: () => getNewReleaseFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  const allFilmsMap = new Map<string, RankedFilm>();
  for (const f of [...topFilms, ...newReleases]) {
    if (!allFilmsMap.has(f.slug)) {
      allFilmsMap.set(f.slug, f);
    }
  }

  const savedFilms = savedSlugs
    .map((slug) => allFilmsMap.get(slug))
    .filter((f): f is RankedFilm => f !== undefined);

  const isLoading = !isLoaded || (savedSlugs.length > 0 && topLoading && newLoading);

  return (
    <Layout>
      <section className="px-4 pt-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              Following
            </div>
            <h1 className="mt-2 font-display text-4xl font-medium leading-tight sm:text-5xl">
              My Watchlist
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Titles you're tracking. Follow their score, rank, and momentum as the Index
              updates.
            </p>
          </div>

          {savedFilms.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-[13px] text-muted-foreground transition hover:border-foreground/25 hover:text-foreground"
            >
              <BookmarkX className="h-3.5 w-3.5" />
              Clear all ({savedFilms.length})
            </button>
          )}
        </div>
      </section>

      <section className="mt-10 px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {isLoading ? (
            <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10">
              {[...Array(4)].map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                  <div className="h-16 w-11 animate-pulse bg-foreground/10 sm:h-[72px] sm:w-12" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 animate-pulse bg-foreground/10" />
                    <div className="h-3 w-28 animate-pulse bg-foreground/10" />
                  </div>
                  <div className="h-6 w-10 animate-pulse bg-foreground/10" />
                </li>
              ))}
            </ul>
          ) : savedFilms.length === 0 ? (
            <div className="border-y border-foreground/10 bg-surface p-12 text-center">
              <Bookmark className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <h2 className="mt-4 font-display text-2xl">Your watchlist is empty</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Save titles with the bookmark button on any film page to follow them here.
              </p>
              <Link
                to="/top-100"
                className="mt-6 inline-block rounded-full bg-foreground px-5 py-2.5 text-[13px] font-medium text-background transition hover:bg-foreground/85"
              >
                Browse the Top 100
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10">
              {savedFilms.map((film) => {
                const director =
                  film.director && film.director !== "Unknown" ? film.director : null;
                return (
                  <li key={film.slug} className="group relative">
                    <Link
                      to="/films/$slug"
                      params={{ slug: film.slug }}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] sm:gap-4 sm:px-5"
                    >
                      <FilmPosterThumbnail
                        film={film}
                        className="h-16 w-11 sm:h-[72px] sm:w-12"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium leading-snug text-foreground sm:text-base">
                          {film.title}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground sm:text-[13px]">
                          {[director, film.year, `${tenureLabel(film)} on chart`]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="index-score text-xl sm:text-2xl">
                          {film.score?.toFixed(1)}
                        </div>
                        {film.rank > 0 && (
                          <div className="mt-0.5 font-mono text-[10px] tabular text-muted-foreground">
                            #{film.rank}
                          </div>
                        )}
                      </div>
                    </Link>
                    <button
                      onClick={() => removeSlug(film.slug)}
                      title="Remove from watchlist"
                      aria-label={`Remove ${film.title} from watchlist`}
                      className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full p-2 text-muted-foreground/60 transition hover:bg-foreground/10 hover:text-down group-hover:block"
                    >
                      <BookmarkX className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </Layout>
  );
}
