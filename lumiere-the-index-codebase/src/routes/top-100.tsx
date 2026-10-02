import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead, LiveStamp } from "@/components/lumiere/PageHead";
import { getTopFilms, type RankedFilm } from "@/lib/apiClient";
import { AdSlot, isAdSlotActive } from "@/components/lumiere/AdSlot";
import { isNewRelease, tenureLabel } from "@/lib/filmUtils";
import { RouteError } from "@/lib/route-error";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { FilmRowSkeleton } from "@/components/lumiere/Skeletons";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";
import { MomentumMark } from "@/components/lumiere/Momentum";

/** Render-order row: a ranked film, or a future non-ranked ad separator. */
type ChartRow = { kind: "film"; film: RankedFilm } | { kind: "ad"; placement: string };

export const Route = createFileRoute("/top-100")({
  head: () => ({
    meta: [
      { title: "Movie 100 · The Index" },
      {
        name: "description",
        content:
          "The movies getting the most attention right now. Updated every 15 minutes.",
      },
      ogUrlMeta("/top-100"),
    ],
    links: [canonicalLink("/top-100")],
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

  // RANKING INDEPENDENCE: rows below are a render-order concern only. Ad rows
  // are interleaved as non-ranked separators — they never receive a rank
  // number, never shift the numbering (ranks come from the API), and never
  // touch the ranking engine. With advertising disabled (current state) no ad
  // row exists and this list is byte-identical to a build without ads.
  const adsAfter20 = isAdSlotActive("top100-after-20");
  const adsAfter50 = isAdSlotActive("top100-after-50");
  const rows: ChartRow[] = [];
  if (!isLoading && !error) {
    (films ?? []).forEach((f, i) => {
      if (adsAfter20 && i === 20) rows.push({ kind: "ad", placement: "top100-after-20" });
      if (adsAfter50 && i === 50) rows.push({ kind: "ad", placement: "top100-after-50" });
      rows.push({ kind: "film", film: f });
    });
  }

  const lead = films?.[0] ?? null;

  return (
    <Layout>
      <PagePlane lead={lead} wide>
        <PageHead
          kicker={
            <>
              The Index · Movie 100 ·{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </>
          }
          title="Movie 100"
          lede="The movies getting the most attention right now. Updated every 15 minutes. A public rank only exists between #1 and #100; titles beyond the chart are simply not currently ranked."
          meta={<LiveStamp>Updated every 15 minutes</LiveStamp>}
        />

        {error ? (
          <div className="ix-sec">
            <div className="ix-note">
              <p className="ix-note__title">Unable to load rankings</p>
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
              <div>Title</div>
              <div>Days</div>
              <div className="ix-thead__r">Momentum</div>
            </div>
            <ul className="ix-rows">
              {isLoading
                ? [...Array(20)].map((_, i) => <FilmRowSkeleton key={i} />)
                : rows.map((row) => {
                    if (row.kind === "ad") {
                      // Ad separator — deliberately NOT a ranked row: no rank
                      // number, no movement, no score, no poster, no title
                      // typography. Occupies zero space while ads are disabled.
                      return (
                        <li key={row.placement}>
                          <AdSlot placement={row.placement} />
                        </li>
                      );
                    }
                    const f = row.film;
                    const change = f.movement ?? null;
                    const director =
                      f.director && f.director !== "Unknown" ? f.director : null;
                    const isNew = f.prev_rank == null && isNewRelease(f);

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

                          {isNew ? (
                            <span className="ix-delta ix-delta--new">New</span>
                          ) : change ? (
                            <span
                              className={`ix-delta ${change > 0 ? "ix-delta--up" : "ix-delta--down"}`}
                              title={change > 0 ? "Climbed" : "Fell"}
                            >
                              {change > 0 ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
                              {Math.abs(change)}
                            </span>
                          ) : (
                            <span className="ix-delta ix-delta--flat" title="Held its rank">
                              <Minus aria-hidden />0
                            </span>
                          )}

                          <span className="ix-row__main">
                            <FilmPosterThumbnail film={f} className="ix-row__art" />
                            <span className="min-w-0">
                              <span className="ix-row__title block">{f.title}</span>
                              <span className="ix-row__meta block">
                                {director ? `${director} · ${f.year}` : f.year}
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
      </PagePlane>
    </Layout>
  );
}
