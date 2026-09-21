import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getWeeklyTop100, type WeeklyEntry } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { ArrowUp, ArrowDown, Tv, Film } from "lucide-react";
import { FilmRowSkeleton } from "@/components/lumiere/Skeletons";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";

export const Route = createFileRoute("/weekly-100")({
  head: () => ({
    meta: [
      { title: "Weekly Top 100 · The Index" },
      {
        name: "description",
        content:
          "The Weekly Top 100: the movies and TV shows that performed best throughout the week.",
      },
      ogUrlMeta("/weekly-100"),
    ],
    links: [canonicalLink("/weekly-100")],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["weekly", "top100"],
      queryFn: () => getWeeklyTop100(),
    });
  },
  component: Weekly100,
  errorComponent: RouteError,
});

function TypeChip({ type }: { type: WeeklyEntry["content_type"] }) {
  const isTv = type === "TV_SHOW";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${
        isTv ? "bg-cream/15 text-cream" : "bg-cream text-ink"
      }`}
    >
      {isTv ? <Tv className="h-2.5 w-2.5" /> : <Film className="h-2.5 w-2.5" />}
      {isTv ? "TV" : "Movie"}
    </span>
  );
}

function WeekLabel({ weekStart, weekEnd }: { weekStart: string; weekEnd: string }) {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <span>
      {fmt(weekStart)} – {fmt(weekEnd)}
    </span>
  );
}

function Weekly100() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["weekly", "top100"],
    queryFn: () => getWeeklyTop100(),
    staleTime: 10 * 60 * 1000,
  });

  const entries = data?.entries ?? [];

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          The Index · Weekly Top 100 ·{" "}
          {data ? (
            <WeekLabel weekStart={data.meta.week_start} weekEnd={data.meta.week_end} />
          ) : (
            "This week"
          )}
        </div>
        <h1 className="mt-2 font-display text-5xl lg:text-6xl">Weekly Top 100</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          The movies and TV shows that performed best throughout the week.
          Sustained performance all week beats a one-day spike. Movies and TV
          shows compete on one chart; each entry is labeled.
        </p>
      </section>

      <section className="mt-10 px-4 lg:px-6">
        {error && (
          <div className="border border-foreground/10 bg-surface p-6 text-center text-sm text-muted-foreground">
            Unable to load the weekly chart right now. Please try again later.
          </div>
        )}
        <div className="border-t-2 border-foreground/20">
          {/* Desktop header row */}
          <div className="hidden grid-cols-[64px_64px_1fr_110px_110px] items-center gap-3 border-b border-foreground/10 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid">
            <div>Rank</div>
            <div>Mvmt</div>
            <div>Title</div>
            <div>Type</div>
            <div className="text-right">Index Score</div>
          </div>
          <ul>
            {isLoading
              ? [...Array(20)].map((_, i) => <FilmRowSkeleton key={i} />)
              : entries.map((e) => {
                  const delta = e.rank_delta || 0;
                  const isDebut = e.previous_week_rank == null;
                  const meta =
                    e.director && e.director !== "Unknown"
                      ? `${e.director} · ${e.year}`
                      : e.year
                        ? String(e.year)
                        : "";

                  return (
                    <li key={`${e.slug}-${e.rank}`}>
                      <Link
                        to="/films/$slug"
                        params={{ slug: e.slug }}
                        className="grid grid-cols-[44px_1fr_72px] items-center gap-3 border-b border-foreground/5 px-4 py-3.5 transition hover:bg-foreground/[0.04] sm:grid-cols-[64px_64px_1fr_110px_110px] sm:px-5"
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="index-score text-2xl font-semibold sm:text-xl">
                            {String(e.rank).padStart(2, "0")}
                          </span>
                          <span className="sm:hidden">
                            {isDebut ? (
                              <span className="rounded bg-cream px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-ink">
                                New
                              </span>
                            ) : delta !== 0 ? (
                              <span
                                className={`flex items-center font-mono text-[10px] tabular ${
                                  delta > 0 ? "text-forest-deep" : "text-down"
                                }`}
                              >
                                {delta > 0 ? (
                                  <ArrowUp className="h-2.5 w-2.5" />
                                ) : (
                                  <ArrowDown className="h-2.5 w-2.5" />
                                )}
                                {Math.abs(delta)}
                              </span>
                            ) : (
                              <span
                                className="font-mono text-[11px] text-muted-foreground"
                                title="Held its rank"
                              >
                                -
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="hidden sm:block">
                          {isDebut ? (
                            <span className="rounded bg-cream px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
                              New
                            </span>
                          ) : delta !== 0 ? (
                            <span
                              className={`flex items-center gap-0.5 font-mono text-xs tabular ${
                                delta > 0 ? "text-forest-deep" : "text-down"
                              }`}
                            >
                              {delta > 0 ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )}
                              {Math.abs(delta)}
                            </span>
                          ) : (
                            <span
                              className="font-mono text-sm text-muted-foreground"
                              title="Held its rank"
                            >
                              -
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex items-center gap-3">
                          <FilmPosterThumbnail film={e} className="h-14 w-10 sm:h-12 sm:w-9" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-display text-[15px] font-medium sm:text-lg">
                                {e.title}
                              </span>
                              <span className="sm:hidden">
                                <TypeChip type={e.content_type} />
                              </span>
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {meta}
                              <span className="sm:hidden">
                                {" "}
                                · {e.total_signal_volume} signals this week
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="hidden sm:block">
                          <TypeChip type={e.content_type} />
                        </div>
                        <div className="text-right">
                          <div className="index-score text-xl font-semibold sm:text-lg">
                            {e.score?.toFixed(1)}
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
          {!isLoading && !error && entries.length === 0 && (
            <div className="border-b border-foreground/10 bg-surface p-6 text-center text-sm text-muted-foreground">
              The first Weekly Top 100 publishes after the next full week of
              measurements.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
