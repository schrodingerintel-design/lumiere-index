import { useWatchlist, writeWatchlist } from "@/lib/watchlist";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQueries } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getFilmDetail } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Bookmark, BookmarkX } from "lucide-react";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";
import { tenureLabel } from "@/lib/filmUtils";
import { MomentumMark } from "@/components/lumiere/Momentum";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "My Watchlist · The Index" },
      { name: "description", content: "Titles you're tracking across the Index." },
      ogUrlMeta("/watchlist"),
    ],
    links: [canonicalLink("/watchlist")],
  }),
  component: WatchlistPage,
  errorComponent: RouteError,
});

function WatchlistPage() {
  const { slugs: savedSlugs } = useWatchlist();
  const removeSlug = (slug: string) => writeWatchlist(savedSlugs.filter((item) => item !== slug));
  const clearAll = () => writeWatchlist([]);
  // Resolve each saved identity directly, including TV and titles that leave the charts.
  const queries = useQueries({
    queries: savedSlugs.map((slug) => ({
      queryKey: ["film", "detail", slug],
      queryFn: () => getFilmDetail(slug),
      staleTime: 300_000,
      retry: false,
    })),
  });
  const savedFilms = queries.flatMap((query) => (query.data ? [query.data] : []));
  const isLoading = queries.some((query) => query.isLoading);
  const unresolvedSlugs = savedSlugs.filter((_, index) => queries[index]?.isError);

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
              Titles you're tracking. Follow their rank and momentum as the Index updates.
            </p>
          </div>

          {savedFilms.length > 0 && (
            <button
              onClick={clearAll}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-[13px] text-muted-foreground transition hover:border-foreground/25 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <BookmarkX className="h-3.5 w-3.5" aria-hidden />
              Clear all ({savedSlugs.length})
            </button>
          )}
        </div>
      </section>

      <section className="mt-10 px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {unresolvedSlugs.length > 0 && (
            <div
              className="mb-5 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground"
              role="status"
            >
              <p>Some saved titles couldn't be loaded. Your bookmarks are still saved.</p>
              <button
                className="mt-2 text-primary underline"
                onClick={() =>
                  queries.forEach((query) => {
                    if (query.isError) void query.refetch();
                  })
                }
              >
                Try again
              </button>
              {unresolvedSlugs.map((slug) => (
                <div key={slug} className="mt-3 flex items-center justify-between gap-4">
                  <Link to="/films/$slug" params={{ slug }}>
                    {slug.replace(/-/g, " ")}
                  </Link>
                  <button className="soft-button" onClick={() => removeSlug(slug)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
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
          ) : savedSlugs.length === 0 ? (
            <div className="border-y border-foreground/10 bg-surface p-12 text-center">
              <Bookmark className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <h2 className="mt-4 font-display text-2xl">Your watchlist is empty</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Save titles with the bookmark button on any film page to follow them here.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/top-100"
                  className="inline-block rounded-full bg-foreground px-5 py-3 min-h-[44px] text-[13px] font-medium text-background transition hover:bg-foreground/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Browse the Movie 100
                </Link>
                <Link
                  to="/tv-100"
                  className="inline-block rounded-full border border-foreground/20 px-5 py-3 min-h-[44px] text-[13px] font-medium text-foreground transition hover:border-foreground/45 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Browse the TV 100
                </Link>
              </div>
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
                      className="flex items-center gap-3 px-4 py-3 pr-14 transition-colors hover:bg-foreground/[0.03] sm:gap-4 sm:px-5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                    >
                      <FilmPosterThumbnail film={film} className="h-16 w-11 sm:h-[72px] sm:w-12" />
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-[15px] font-medium leading-snug text-foreground sm:text-base"
                          title={film.title}
                        >
                          {film.title}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground sm:text-[13px]">
                          {[director, film.year, `${tenureLabel(film)} on chart`]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <MomentumMark state={film.momentum} />
                        {film.rank > 0 && (
                          <div className="mt-1 font-mono text-[10px] tabular text-muted-foreground">
                            #{film.rank}
                          </div>
                        )}
                      </div>
                    </Link>
                    <button
                      onClick={() => removeSlug(film.slug)}
                      title="Remove from watchlist"
                      aria-label={`Remove ${film.title} from watchlist`}
                      className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground/70 transition hover:bg-foreground/10 hover:text-down focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    >
                      <BookmarkX className="h-4 w-4" aria-hidden />
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
