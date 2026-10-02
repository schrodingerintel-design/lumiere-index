import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead, LiveStamp } from "@/components/lumiere/PageHead";
import { getTopFilms, getMetaRefresh, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { FilmRowSkeleton } from "@/components/lumiere/Skeletons";
import { Movement } from "@/components/lumiere/ChartMovement";
import { MomentumMark } from "@/components/lumiere/Momentum";
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

/** The live #1 series — rank, movement and momentum lead, everything else supports. */
function ChampionSeries({ film }: { film: RankedFilm }) {
  const director =
    film.director && film.director !== "Unknown" ? film.director : null;

  return (
    <div className="ix-champion">
      <div className="ix-champion__body">
        <span className="ix-phead__kicker">#1 TV 100</span>
        <h2 className="ix-champion__title">
          <Link to="/films/$slug" params={{ slug: film.slug }}>
            {film.title}
          </Link>
        </h2>
        <div className="ix-champion__meta">
          {[director, film.year].filter(Boolean).join(" · ")}
        </div>

        {/* The state of change is the headline */}
        <div className="ix-champion__stats">
          <MomentumMark state={film.momentum} />
          {film.peak_rank ? <span>Peak #{film.peak_rank}</span> : null}
          <span>{film.days_on_chart ?? 1}d on chart</span>
        </div>
      </div>

      <Link
        to="/films/$slug"
        params={{ slug: film.slug }}
        aria-label={`Open ${film.title}`}
        className="ix-champion__art"
      >
        <FilmPosterThumbnail film={film} className="ix-champion__poster" />
      </Link>
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

  // Scores are internal; the page presents rank, movement and momentum.
  // (An earlier local rescale, score / #1 × 98.5, was removed: it exploded
  // whenever a lower-ranked title carried more raw attention — e.g. 844.8.)

  return (
    <Layout>
      <PagePlane lead={champion} wide>
        <PageHead
          kicker="The Index · TV 100"
          title="TV 100"
          lede={`The TV shows getting the most attention right now. Updated every 15 minutes.${snapshotLabel ? ` Last refresh ${snapshotLabel}.` : ""}`}
          meta={
            <>
              {countdown ? (
                <span className="ix-phead__count">
                  <b>{countdown}</b>
                  Next refresh
                </span>
              ) : null}
              <ShareCardButton
                variant="chart"
                card={{
                  title: "TV 100",
                  subtitle: "The TV shows getting the most attention right now.",
                  films: entries.slice(0, 5),
                  rankOf: (_f, i) => i + 1,
                }}
              />
              <LiveStamp>Live</LiveStamp>
            </>
          }
        />

        {champion ? (
          <div className="ix-sec !pt-0">
            <ChampionSeries film={champion} />
          </div>
        ) : null}

        {error ? (
          <div className="ix-sec">
            <div className="ix-note">
              <p className="ix-note__title">Unable to load the TV 100</p>
              <p className="ix-note__body">
                The chart engine did not answer. Please try again shortly.
              </p>
            </div>
          </div>
        ) : (
          <div className="ix-sec !pt-0">
            <div className="ix-thead">
              <div>Rank</div>
              <div>Mvmt</div>
              <div>Series</div>
              <div>Days</div>
              <div className="ix-thead__r">Momentum</div>
            </div>
            <ul className="ix-rows">
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
                          className="ix-row"
                        >
                          <span className="ix-row__rk">
                            {String(f.rank).padStart(2, "0")}
                          </span>

                          <Movement film={f} />

                          <span className="ix-row__main">
                            <FilmPosterThumbnail film={f} className="ix-row__art" />
                            <span className="min-w-0">
                              <span className="ix-row__title block">{f.title}</span>
                              <span className="ix-row__meta block">
                                {[director, filmYear(f)].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </span>

                          <span className="ix-row__num">{tenureLabel(f)}</span>
                          <span className="ix-row__r">
                            <MomentumMark state={f.momentum} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
            </ul>
          </div>
        )}

        {!isLoading && !error && entries.length === 0 ? (
          <div className="ix-sec">
            <div className="ix-note">
              <p className="ix-note__title">The TV 100 is being prepared</p>
              <p className="ix-note__body">
                Rankings appear after the next refresh cycle.
              </p>
            </div>
          </div>
        ) : null}
      </PagePlane>
    </Layout>
  );
}

/** TV rows show the first-air year; fall back to the film year field. */
function filmYear(f: RankedFilm): number | null {
  if (f.first_air_date) return new Date(f.first_air_date).getFullYear();
  return f.year ?? null;
}
