import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getTopFilms, getMetaRefresh, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { FilmRowSkeleton } from "@/components/lumiere/Skeletons";
import { Movement } from "@/components/lumiere/Ranking";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";
import { tenureLabel } from "@/lib/filmUtils";
import { ShareCardButton } from "@/components/lumiere/ShareCardButton";
import { AdSlot, isAdSlotActive } from "@/components/lumiere/AdSlot";

/** Render-order row: a ranked series, or a future non-ranked ad separator. */
type TvChartRow = { kind: "film"; film: RankedFilm } | { kind: "ad"; placement: string };

export const Route = createFileRoute("/tv-100")({
  head: () => ({
    meta: [
      { title: "TV 100 · The Index" },
      {
        name: "description",
        content:
          "The TV shows getting the most attention right now. Updated every 15 minutes.",
      },
      { property: "og:title", content: "TV 100 · The Index" },
      {
        property: "og:description",
        content:
          "The TV shows getting the most attention right now. Updated every 15 minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TV 100 · The Index" },
      {
        name: "twitter:description",
        content:
          "The TV shows getting the most attention right now. Updated every 15 minutes.",
      },
      ogUrlMeta("/tv-100"),
    ],
    links: [canonicalLink("/tv-100")],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["films", "tv100", 100],
      queryFn: () => getTopFilms(100, 0, "TV_100"),
    });
  },
  component: TV100,
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

/** The live #1 series — the TVDex Score leads, everything else supports it. */
function ChampionSeries({ film }: { film: RankedFilm }) {
  const director =
    film.director && film.director !== "Unknown" ? film.director : null;

  return (
    <div className="border-y border-foreground/10 bg-surface p-6 sm:p-8">
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            #1 TV 100
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
              TVDex
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

function TV100() {
  // The official TV 100 — the live TV chart on its own 1–100 numbering.
  // The API serves this chart directly (chart=TV_100), so rows carry their
  // real TV-chart positions; no client-side renumbering, no global ranks.
  const { data: films, isLoading, error } = useQuery({
    queryKey: ["films", "tv100", 100],
    queryFn: () => getTopFilms(100, 0, "TV_100"),
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

  // RANKING INDEPENDENCE: ad rows are interleaved as non-ranked separators
  // only — they never receive a TVDex score or TV-chart rank, and the ad
  // system has no connection to the ranking engine. With advertising
  // disabled (current state) the list is exactly as it is today.
  const adsAfter10 = isAdSlotActive("tv100-after-10");
  const adsAfter30 = isAdSlotActive("tv100-after-30");
  const rows: TvChartRow[] = [];
  if (!isLoading && !error) {
    entries.forEach((f, i) => {
      if (adsAfter10 && i === 10) rows.push({ kind: "ad", placement: "tv100-after-10" });
      if (adsAfter30 && i === 30) rows.push({ kind: "ad", placement: "tv100-after-30" });
      rows.push({ kind: "film", film: f });
    });
  }

  // TVDex scores come straight from the API's Index Score scale (the beta
  // calibration already anchors the chart head near 98.5). An earlier local
  // rescale (score / #1 × 98.5) exploded whenever a lower-ranked title
  // measured more raw attention than #1 — e.g. 844.8 — and has been removed:
  // rank orders the chart, the score is each title's own truth.
  const tvScore = (f: RankedFilm): number => f.score ?? 0;

  return (
    <Layout>
      <section className="px-4 pt-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              The Index · TV 100 · Live
            </div>
            <h1 className="mt-2 font-display text-4xl font-medium leading-tight sm:text-5xl">
              TV 100
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              The TV shows getting the most attention right now. Updated every
              15 minutes.{snapshotLabel ? ` Last refresh ${snapshotLabel}.` : ""}
            </p>
          </div>
          <div className="flex items-end gap-6">
            {countdown && (
              <div className="text-right">
                <div className="font-mono text-2xl tabular text-foreground">{countdown}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Next refresh
                </div>
              </div>
            )}
            <ShareCardButton
              variant="chart"
              card={{
                title: "TV 100",
                subtitle: "The TV shows getting the most attention right now.",
                films: entries.slice(0, 5).map((f) => ({
                  ...f,
                  score: tvScore(f),
                })),
                rankOf: (_f, i) => i + 1,
                scoreLabel: "TVDex",
              }}
              className="mb-1"
            />
          </div>
        </div>
      </section>

      {champion && (
        <section className="mt-8 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <ChampionSeries
              film={{ ...champion, score: tvScore(champion) }}
            />
          </div>
        </section>
      )}

      <section className="mt-10 px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="border-y border-foreground/10 bg-surface p-8 text-center text-sm text-muted-foreground">
              Unable to load the TV 100 right now. Please try again later.
            </div>
          )}
          <div className="border-t-2 border-foreground/20">
            {/* Desktop header row */}
            <div className="hidden grid-cols-[64px_64px_1fr_80px_110px] items-center gap-3 border-b border-foreground/10 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid">
              <div>Rank</div>
              <div>Mvmt</div>
              <div>Series</div>
              <div>Days</div>
              <div className="text-right">TVDex Score</div>
            </div>
            <ul>
              {isLoading
                ? [...Array(20)].map((_, i) => <FilmRowSkeleton key={i} />)
                : rows.map((row) => {
                    if (row.kind === "ad") {
                      // Non-ranked separator: no rank number, no TVDex score,
                      // no movement. Zero space while ads are disabled.
                      return (
                        <li key={row.placement}>
                          <AdSlot placement={row.placement} />
                        </li>
                      );
                    }
                    const f = row.film;
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
                                {[director, filmYear(f)].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </div>
                          <div className="hidden font-mono text-xs tabular text-muted-foreground sm:block">
                            {tenureLabel(f)}
                          </div>
                          <div className="text-right">
                            <div className="index-score text-xl font-semibold sm:text-lg">
                              {tvScore(f).toFixed(1)}
                            </div>
                            <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                              TVDex
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
              The TV 100 is being prepared. Rankings appear after the next refresh cycle.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

/** TV rows show the first-air year; fall back to the film year field. */
function filmYear(f: RankedFilm): number | null {
  if (f.first_air_date) return new Date(f.first_air_date).getFullYear();
  return f.year ?? null;
}
