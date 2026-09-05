import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getNewReleaseFilms, getTopFilms, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Bookmark, BookmarkX, Scale, ArrowRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "My Watchlist — Lumière The Index" },
      { name: "description", content: "Saved films and cultural intelligence watchlist." },
    ],
  }),
  component: WatchlistPage,
  errorComponent: RouteError,
});

function gradientStyle(film: RankedFilm) {
  const from = film.gradient_from ?? "#2a2a2a";
  const to = film.gradient_to ?? "#111";
  return `linear-gradient(155deg, ${from}, ${to})`;
}

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
      <section className="px-4 pt-6 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Bookmark className="h-3.5 w-3.5 text-primary" />
              <span>Personal Tracking</span>
            </div>
            <h1 className="mt-2 font-serif text-5xl lg:text-6xl">My Watchlist</h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Films you are monitoring. Track score shifts, audience sentiment, and momentum across the Index.
            </p>
          </div>

          {savedFilms.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-4 py-2 font-mono text-xs text-muted-foreground transition hover:border-foreground/30 hover:bg-foreground/10 hover:text-foreground"
            >
              <BookmarkX className="h-3.5 w-3.5" />
              Clear All ({savedFilms.length})
            </button>
          )}
        </div>
      </section>

      <section className="mt-10 px-4 lg:px-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass rounded-2xl p-4 flex gap-4 animate-pulse">
                <div className="h-36 w-24 rounded-xl bg-foreground/10 shrink-0" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="h-5 w-3/4 rounded bg-foreground/10" />
                  <div className="h-4 w-1/2 rounded bg-foreground/10" />
                  <div className="h-8 w-full rounded bg-foreground/10 mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : savedFilms.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bookmark className="h-7 w-7" />
            </div>
            <h2 className="font-serif text-2xl text-foreground">Your watchlist is empty</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Save films by clicking the <strong>Save</strong> button on any film page to track their audience signals, rank changes, and cultural velocity here.
            </p>
            <div className="pt-2">
              <Link
                to="/top-100"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-mono text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <span>Explore Top 100 Films</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {savedFilms.map((film) => (
              <Link
                key={film.slug}
                to="/films/$slug"
                params={{ slug: film.slug }}
                className="glass card-lift group flex flex-col overflow-hidden rounded-2xl transition"
              >
                {/* Poster */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-ink">
                  {film.poster_url ? (
                    <img
                      src={film.poster_url}
                      alt={film.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="h-full w-full flex items-center justify-center p-4 text-center text-sm text-muted-foreground"
                      style={{ background: gradientStyle(film) }}
                    >
                      {film.title}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {film.rank > 0 && (
                    <span className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 font-mono text-xs font-bold text-primary backdrop-blur">
                      #{film.rank}
                    </span>
                  )}
                  <div className="absolute inset-x-3 bottom-3">
                    <div className="font-serif text-lg font-medium text-white leading-tight">
                      {film.title}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {film.director || "Director TBA"} · {film.year || "—"}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-sm text-primary font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Score {film.score?.toFixed(1) ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                      <Scale className="h-3 w-3" />
                      Compare
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeSlug(film.slug);
                      }}
                      title="Remove from watchlist"
                      className="flex items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition hover:border-down/30 hover:bg-down/10 hover:text-down"
                    >
                      <BookmarkX className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                  <div className="flex items-center justify-between border-t border-foreground/10 pt-3 font-mono text-[10px] text-muted-foreground transition group-hover:text-primary">
                    <span>View Signal Breakdown</span>
                    <span>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
