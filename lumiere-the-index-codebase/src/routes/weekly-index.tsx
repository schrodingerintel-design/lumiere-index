import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getWeeklyIndex, type WeeklyEntry } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { ArrowUp, ArrowDown } from "lucide-react";
import { FilmRowSkeleton } from "@/components/lumiere/Skeletons";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";

export const Route = createFileRoute("/weekly-index")({
  head: () => ({
    meta: [
      { title: "Weekly Index — Lumière The Index" },
      {
        name: "description",
        content:
          "The official Weekly Index: the 100 films and shows that defined the week, aggregated from seven days of audience signals — not a copy of any single day.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["index", "weekly", 100],
      queryFn: () => getWeeklyIndex(100),
    });
  },
  component: WeeklyIndex,
  errorComponent: RouteError,
});

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Sep 7 – Sep 13, 2026" — handles both ends falling in different months. */
function weekRangeLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const endD = new Date(`${end}T00:00:00`);
  const year = Number.isNaN(endD.getTime()) ? "" : `, ${endD.getFullYear()}`;
  return `${formatDay(start)} – ${formatDay(end)}${year}`;
}

/** Weekly movement: rank_delta is positive when a title climbed. */
function WeeklyMovement({ entry }: { entry: WeeklyEntry }) {
  if (entry.previous_week_rank == null) {
    return (
      <span
        className="rounded bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink"
        title="First week on the Weekly Index"
      >
        New
      </span>
    );
  }
  if (entry.rank_delta > 0) {
    return (
      <span
        className="flex items-center gap-0.5 font-mono text-xs tabular text-forest-deep"
        title={`Up ${entry.rank_delta} from last week's Index (#${entry.previous_week_rank})`}
      >
        <ArrowUp className="h-3 w-3" />
        {entry.rank_delta}
      </span>
    );
  }
  if (entry.rank_delta < 0) {
    return (
      <span
        className="flex items-center gap-0.5 font-mono text-xs tabular text-down"
        title={`Down ${Math.abs(entry.rank_delta)} from last week's Index (#${entry.previous_week_rank})`}
      >
        <ArrowDown className="h-3 w-3" />
        {Math.abs(entry.rank_delta)}
      </span>
    );
  }
  return (
    <span className="font-mono text-sm text-muted-foreground" title="Held last week's rank">
      —
    </span>
  );
}

function signalLabel(volume: number): string {
  return volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : String(volume);
}

/** The week's #1 — the Index Score leads, everything else supports it. */
function WeeklyChampion({ entry }: { entry: WeeklyEntry }) {
  const director =
    entry.director && entry.director !== "Unknown" ? entry.director : "Director TBA";
  const isNew = entry.previous_week_rank == null;

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-6 sm:p-8">
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.24em] text-primary">
            #1 On The Weekly Index
          </div>
          <h2 className="mt-2 truncate font-display text-4xl font-semibold sm:text-5xl">
            {entry.title}
          </h2>
          <div className="mt-1.5 text-sm text-muted-foreground">
            {director} · {entry.year ?? "—"}
            {isNew ? " · First week on the chart" : ""}
          </div>

          <div className="mt-5 flex items-end gap-3">
            <span className="index-score text-6xl leading-none font-semibold sm:text-7xl">
              {entry.score?.toFixed(1)}
            </span>
            <span className="pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Weekly
              <br />
              Index Score
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="rounded-full border border-foreground/15 px-2.5 py-1">
              {signalLabel(entry.total_signal_volume)} signals this week
            </span>
            {entry.previous_week_rank != null ? (
              <span className="rounded-full border border-foreground/15 px-2.5 py-1">
                Last week #{entry.previous_week_rank}
              </span>
            ) : null}
          </div>
        </div>

        <FilmPosterThumbnail
          film={entry}
          className="hidden h-56 w-38 rounded-xl sm:block"
        />
      </div>
    </div>
  );
}

function WeeklyIndex() {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["index", "weekly", 100],
    queryFn: () => getWeeklyIndex(100),
    staleTime: 30 * 60 * 1000,
  });

  const entries = data?.entries ?? [];
  const meta = data?.meta ?? null;
  const range = meta ? weekRangeLabel(meta.week_start, meta.week_end) : "";
  const published = meta?.published_at
    ? new Date(meta.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const champion = entries.length > 0 ? entries[0] : null;

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          The Index · Weekly Ranking{range ? ` · ${range}` : ""}
        </div>
        <h1 className="mt-2 font-display text-5xl lg:text-6xl">Weekly Index</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          What defined this week in cinema. Aggregated across the full measurement window —
          not a snapshot of any single day.
          {published ? ` Published ${published}.` : ""}
        </p>
      </section>

      {champion && (
        <section className="mt-8 px-4 lg:px-6">
          <WeeklyChampion entry={champion} />
        </section>
      )}

      <section className="mt-10 px-4 lg:px-6">
        {error && (
          <div className="border border-foreground/10 bg-surface p-6 text-center text-sm text-muted-foreground">
            Unable to load the Weekly Index right now. Please try again later.
          </div>
        )}
        <div className="border-t-2 border-foreground/20">
          {/* Desktop header row */}
          <div className="hidden grid-cols-[64px_64px_1fr_110px_110px] items-center gap-3 border-b border-foreground/10 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid">
            <div>Rank</div>
            <div>Mvmt</div>
            <div>Title</div>
            <div className="text-right">Signals</div>
            <div className="text-right">Weekly Score</div>
          </div>
          <ul>
            {isLoading
              ? [...Array(20)].map((_, i) => <FilmRowSkeleton key={i} />)
              : entries.map((entry) => {
                  const director =
                    entry.director && entry.director !== "Unknown"
                      ? entry.director
                      : "Director TBA";
                  return (
                    <li key={entry.slug}>
                      <Link
                        to="/films/$slug"
                        params={{ slug: entry.slug }}
                        /* Mobile: stacked card — rank/movement/title/score, meta underneath.
                           Desktop: full scan table. No horizontal overflow anywhere. */
                        className="grid grid-cols-[44px_1fr_72px] items-center gap-3 border-b border-foreground/5 px-4 py-3.5 transition hover:bg-foreground/[0.04] sm:grid-cols-[64px_64px_1fr_110px_110px] sm:px-5"
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="index-score text-2xl font-semibold sm:text-xl">
                            {String(entry.rank).padStart(2, "0")}
                          </span>
                          <span className="sm:hidden">
                            <WeeklyMovement entry={entry} />
                          </span>
                        </div>
                        <div className="hidden sm:block">
                          <WeeklyMovement entry={entry} />
                        </div>
                        <div className="min-w-0 flex items-center gap-3">
                          <FilmPosterThumbnail film={entry} className="h-14 w-10 sm:h-12 sm:w-9" />
                          <div className="min-w-0">
                            <div className="truncate font-display text-[15px] font-medium sm:text-lg">
                              {entry.title}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {director} · {entry.year ?? "—"}
                            </div>
                          </div>
                        </div>
                        <div className="hidden text-right font-mono text-xs tabular text-muted-foreground sm:block">
                          {signalLabel(entry.total_signal_volume)}
                        </div>
                        <div className="text-right">
                          <div className="index-score text-xl font-semibold sm:text-lg">
                            {entry.score?.toFixed(1)}
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
            No Weekly Index has been published yet. The first edition appears once a full
            measurement window completes.
          </div>
        )}
      </section>
    </Layout>
  );
}
