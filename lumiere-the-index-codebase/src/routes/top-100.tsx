import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getTopFilms } from "@/lib/apiClient";
import { isNewRelease } from "@/lib/filmUtils";
import { filmTrend } from "@/lib/trend";
import { RouteError } from "@/lib/route-error";
import { ArrowUp, ArrowDown } from "lucide-react";
import { FilmRowSkeleton } from "@/components/lumiere/Skeletons";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";

export const Route = createFileRoute("/top-100")({
  head: () => ({
    meta: [
      { title: "Top 100 — Lumière The Index" },
      {
        name: "description",
        content:
          "The 100 films currently generating the strongest cultural momentum across audience conversation, attention and visibility.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["films", "top", 100],
      queryFn: () => getTopFilms(100),
    });
  },
  component: Top100,
  errorComponent: RouteError,
});

function Top100() {
  const {
    data: films,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          The Index · Daily Ranking ·{" "}
          {new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <h1 className="mt-2 font-display text-5xl lg:text-6xl">The Top 100</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          The 100 films currently generating the strongest cultural momentum across audience
          conversation, attention and visibility.
        </p>
      </section>

      <section className="mt-10 px-4 lg:px-6">
        {error && (
          <div className="border border-foreground/10 bg-surface p-6 text-center text-sm text-muted-foreground">
            Unable to load rankings right now. Please try again later.
          </div>
        )}
        <div className="border-t-2 border-foreground/20">
          {/* Desktop header row */}
          <div className="hidden grid-cols-[64px_64px_1fr_90px_110px_90px] items-center gap-3 border-b border-foreground/10 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid">
            <div>Rank</div>
            <div>Mvmt</div>
            <div>Title</div>
            <div>Weeks</div>
            <div className="text-right">Index Score</div>
            <div className="text-right">Signals</div>
          </div>
          <ul>
            {isLoading
              ? [...Array(20)].map((_, i) => <FilmRowSkeleton key={i} />)
              : films?.map((f) => {
                  const change = f.movement ?? null;
                  const director =
                    f.director && f.director !== "Unknown" ? f.director : "Director TBA";
                  // NEW entries have no previous snapshot — a week count would be
                  // meaningless (and contradictory) next to the NEW badge.
                  const weeks = f.prev_rank == null ? null : (f.weeks_on_chart ?? 1);
                  const signals =
                    f.mentions_total >= 1000
                      ? `${(f.mentions_total / 1000).toFixed(1)}k`
                      : String(f.mentions_total);
                  const isNew = f.prev_rank == null && isNewRelease(f);

                  return (
                    <li key={f.slug}>
                      <Link
                        to="/films/$slug"
                        params={{ slug: f.slug }}
                        /* Mobile: stacked card — rank/movement/title/score, meta underneath.
                           Desktop: full 6-column scan table. No horizontal overflow anywhere. */
                        className="grid grid-cols-[44px_1fr_72px] items-center gap-3 border-b border-foreground/5 px-4 py-3.5 transition hover:bg-foreground/[0.04] sm:grid-cols-[64px_64px_1fr_90px_110px_90px] sm:px-5"
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="index-score text-2xl font-semibold sm:text-xl">
                            {String(f.rank).padStart(2, "0")}
                          </span>
                          <span className="sm:hidden">
                            {isNew ? (
                              <span className="rounded bg-live px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-ink">
                                New
                              </span>
                            ) : change !== null && change !== 0 ? (
                              <span
                                className={`flex items-center font-mono text-[10px] tabular ${change > 0 ? "text-forest-deep" : "text-down"}`}
                              >
                                {change > 0 ? (
                                  <ArrowUp className="h-2.5 w-2.5" />
                                ) : (
                                  <ArrowDown className="h-2.5 w-2.5" />
                                )}
                                {Math.abs(change)}
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] text-primary" title="Held its rank">
                                —
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="hidden sm:block">
                          {isNew ? (
                            <span className="rounded bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
                              New
                            </span>
                          ) : change !== null && change !== 0 ? (
                            <span
                              className={`flex items-center gap-0.5 font-mono text-xs tabular ${change > 0 ? "text-forest-deep" : "text-down"}`}
                            >
                              {change > 0 ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )}
                              {Math.abs(change)}
                            </span>
                          ) : (
                            <span
                              className="font-mono text-sm text-primary"
                              title="Held its rank"
                            >
                              —
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex items-center gap-3">
                          <FilmPosterThumbnail film={f} className="h-14 w-10 sm:h-12 sm:w-9" />
                          <div className="min-w-0">
                            <div className="truncate font-display text-[15px] font-medium sm:text-lg">
                              {f.title}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {director} · {f.year}
                              <span className="sm:hidden">
                                {weeks != null ? ` · ${weeks} ${weeks === 1 ? "wk" : "wks"}` : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="hidden font-mono text-xs tabular text-muted-foreground sm:block">
                          {weeks != null ? `${weeks} ${weeks === 1 ? "wk" : "wks"}` : "—"}
                        </div>
                        <div className="text-right">
                          <div className="index-score text-xl font-semibold sm:text-lg">
                            {f.score?.toFixed(1)}
                          </div>
                          <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                            Index
                          </div>
                        </div>
                        <div className="hidden text-right font-mono text-xs tabular text-muted-foreground font-medium sm:block">
                          {signals}
                        </div>
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </div>
      </section>
    </Layout>
  );
}
