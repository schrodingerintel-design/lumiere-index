import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getTopFilms, getMetaRefresh, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { FilmRowSkeleton } from "@/components/lumiere/Skeletons";
import { Movement } from "@/components/lumiere/Ranking";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";
import { tenureLabel } from "@/lib/filmUtils";

export const Route = createFileRoute("/hot-50")({
  head: () => ({
    meta: [
      { title: "Hot 50 — The Index" },
      {
        name: "description",
        content:
          "The live Hot 50 — the 50 titles capturing the most cultural attention right now, refreshed every 15 minutes.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["films", "hot50", 50],
      queryFn: () => getTopFilms(50),
    });
  },
  component: Hot50,
  errorComponent: RouteError,
});

/** Countdown to the next 15-minute refresh — "12m 04s". */
function useCountdown(nextRefreshAt: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!nextRefreshAt) return "";
  const diff = new Date(nextRefreshAt).getTime() - now;
  if (diff <= 0) return "refreshing…";
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The live #1 — the Index Score leads, everything else supports it. */
function Hot50Champion({ film }: { film: RankedFilm }) {
  const director =
    film.director && film.director !== "Unknown" ? film.director : null;

  return (
    <div className="border-y border-foreground/10 bg-surface p-6 sm:p-8">
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            #1 Right Now
          </div>
          <h2 className="mt-2 truncate font-display text-4xl font-medium leading-tight sm:text-5xl">
            <Link
              to="/films/$slug"
              params={{ slug: film.slug }}
              className="transition-colors hover:text-primary"
            >
              {film.title}
            </Link>
          </h2>
          <div className="mt-1.5 text-sm text-muted-foreground">
            {[director, film.year].filter(Boolean).join(" · ")}
          </div>

          {/* The number is the headline */}
          <div className="mt-5 flex items-end gap-3">
            <span className="index-score text-6xl sm:text-7xl">
              {film.score?.toFixed(1)}
            </span>
            <span className="pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Index
              <br />
              Score
            </span>
          </div>
        </div>

        <Link
          to="/films/$slug"
          params={{ slug: film.slug }}
          aria-label={`Open ${film.title}`}
          className="hidden sm:block"
        >
          <FilmPosterThumbnail film={film} className="h-64 w-44" />
        </Link>
      </div>
    </div>
  );
}

function Hot50() {
  // The Hot 50 IS the live computation layer — refreshed on the same
  // 15-minute cadence the backend recomputes rankings.
  const { data: films, isLoading, error } = useQuery({
    queryKey: ["films", "hot50", 50],
    queryFn: () => getTopFilms(50),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });

  const { data: refreshMeta } = useQuery({
    queryKey: ["meta", "refresh"],
    queryFn: () => getMetaRefresh(),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
  const countdown = useCountdown(refreshMeta?.next_refresh_at ?? null);

  const snapshotLabel = refreshMeta?.snapshot_at
    ? new Date(refreshMeta.snapshot_at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const entries = films ?? [];
  const champion = entries.length > 0 ? entries[0] : null;

  return (
    <Layout>
      <section className="px-4 pt-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              The Index · Live
            </div>
            <h1 className="mt-2 font-display text-4xl font-medium leading-tight sm:text-5xl">
              Hot 50
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              The 50 titles capturing the most cultural attention right now, re-ranked every 15
              minutes.
              {snapshotLabel ? ` Last refresh ${snapshotLabel}.` : ""}
            </p>
          </div>
          {countdown && (
            <div className="text-right">
              <div className="font-mono text-2xl tabular text-foreground">{countdown}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Next refresh
              </div>
            </div>
          )}
        </div>
      </section>

      {champion && (
        <section className="mt-8 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <Hot50Champion film={champion} />
          </div>
        </section>
      )}

      <section className="mt-10 px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="border-y border-foreground/10 bg-surface p-8 text-center text-sm text-muted-foreground">
              Unable to load the Hot 50 right now. Please try again later.
            </div>
          )}
          <div className="border-t-2 border-foreground/20">
            {/* Desktop header row */}
            <div className="hidden grid-cols-[64px_64px_1fr_80px_110px] items-center gap-3 border-b border-foreground/10 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid">
              <div>Rank</div>
              <div>Mvmt</div>
              <div>Title</div>
              <div>Days</div>
              <div className="text-right">Index Score</div>
            </div>
            <ul>
              {isLoading
                ? [...Array(20)].map((_, i) => <FilmRowSkeleton key={i} />)
                : entries.map((f) => {
                    const director =
                      f.director && f.director !== "Unknown" ? f.director : null;
                    return (
                      <li key={f.slug}>
                        <Link
                          to="/films/$slug"
                          params={{ slug: f.slug }}
                          /* Mobile: stacked card — rank/movement/title/score, meta underneath.
                             Desktop: full scan table. No horizontal overflow anywhere. */
                          className="grid grid-cols-[44px_1fr_72px] items-center gap-3 border-b border-foreground/5 px-4 py-3.5 transition hover:bg-foreground/[0.03] sm:grid-cols-[64px_64px_1fr_80px_110px] sm:px-5"
                        >
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="index-score text-2xl font-semibold sm:text-xl">
                              {String(f.rank).padStart(2, "0")}
                            </span>
                            <span className="sm:hidden">
                              <Movement film={f} />
                            </span>
                          </div>
                          <div className="hidden sm:block">
                            <Movement film={f} />
                          </div>
                          <div className="min-w-0 flex items-center gap-3">
                            <FilmPosterThumbnail
                              film={f}
                              className="h-14 w-10 sm:h-12 sm:w-9"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-[15px] font-medium sm:text-lg">
                                {f.title}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {[director, f.year].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </div>
                          <div className="hidden font-mono text-xs tabular text-muted-foreground sm:block">
                            {tenureLabel(f)}
                          </div>
                          <div className="text-right">
                            <div className="index-score text-xl font-semibold sm:text-lg">
                              {f.score?.toFixed(1)}
                            </div>
                            <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                              Index
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
            </ul>
          </div>

          {!isLoading && !error && entries.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              The Hot 50 is being prepared. Rankings appear after the next refresh cycle.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
