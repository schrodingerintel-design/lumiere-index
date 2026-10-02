import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead, LiveStamp } from "@/components/lumiere/PageHead";
import { getBiggestMovers } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { ArrowDown, ArrowUp } from "lucide-react";
import { FilmCardSkeleton } from "@/components/lumiere/Skeletons";
import { posterAt } from "@/lib/tmdbImage";

export const Route = createFileRoute("/rising")({
  head: () => ({
    meta: [
      { title: "Biggest Movers · The Index" },
      {
        name: "description",
        content:
          "The biggest rank changes on The Index: the largest climbers and decliners.",
      },
      ogUrlMeta("/rising"),
    ],
    links: [canonicalLink("/rising")],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["index", "movers"],
      queryFn: () => getBiggestMovers(),
    });
  },
  component: BiggestMovers,
  errorComponent: RouteError,
});

function MoverCard({
  film,
}: {
  film: {
    slug: string;
    title: string;
    poster_url: string | null;
    gradient_from: string | null;
    gradient_to: string | null;
    direction: "up" | "down";
    movement: number;
    previous_rank: number | null;
    current_rank: number;
    current_score: number;
  };
}) {
  const up = film.direction === "up";
  const poster = posterAt(film.poster_url, "w342") || undefined;
  return (
    <Link to="/films/$slug" params={{ slug: film.slug }} className="ix-card">
      <div
        className="ix-card__art"
        style={{
          background: `linear-gradient(155deg, ${film.gradient_from ?? "#2a3140"}, ${film.gradient_to ?? "#131720"})`,
        }}
      >
        {poster ? (
          <img src={poster} alt={`${film.title} poster`} loading="lazy" decoding="async" />
        ) : (
          <div className="ix-card__fallback">{film.title}</div>
        )}

        {/* Current rank — the measurement, always visible */}
        <span className="ix-card__rk">#{film.current_rank}</span>

        {/* Where it came from, and how far it travelled. */}
        <div className="ix-card__plate">
          <div className="ix-card__plate-t">{film.title}</div>
          <div className="ix-card__plate-l">
            <span>
              {film.previous_rank != null
                ? `#${film.previous_rank} → #${film.current_rank}`
                : "Now charting"}
            </span>
            <span className={`ix-delta ${up ? "ix-delta--up" : "ix-delta--down"}`}>
              {up ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
              {Math.abs(film.movement)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function BiggestMovers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["index", "movers"],
    queryFn: () => getBiggestMovers(),
    staleTime: 5 * 60 * 1000,
  });

  const gainers = data?.gainers ?? [];
  const decliners = data?.decliners ?? [];

  return (
    <Layout>
      <PagePlane lead={gainers[0] ?? null} wide>
        <PageHead
          kicker="The Index"
          title="Biggest Movers"
          lede="The largest rank changes between published charts: which titles moved the most, up or down. Movement is measured in rank positions, never score points."
          meta={<LiveStamp>Updated every 15 minutes</LiveStamp>}
        />

        {error ? (
          <div className="ix-sec">
            <div className="ix-note">
              <p className="ix-note__title">Unable to load data</p>
              <p className="ix-note__body">
                The chart engine did not answer. Please try again shortly.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="ix-sec">
            <div className="ix-grid">
              {[...Array(10)].map((_, i) => (
                <FilmCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="ix-sec">
              <h2 className="ix-sec-hd ix-sec-hd--up">
                <ArrowUp aria-hidden />
                Climbing
              </h2>
              {gainers.length === 0 ? (
                <p className="ix-empty">
                  No rank changes in the latest published Index yet.
                </p>
              ) : (
                <div className="ix-grid">
                  {gainers.map((f) => (
                    <MoverCard key={f.slug} film={f} />
                  ))}
                </div>
              )}
            </div>

            <div className="ix-sec">
              <h2 className="ix-sec-hd ix-sec-hd--down">
                <ArrowDown aria-hidden />
                Falling
              </h2>
              {decliners.length === 0 ? (
                <p className="ix-empty">
                  No downward movement in the latest published Index yet.
                </p>
              ) : (
                <div className="ix-grid">
                  {decliners.map((f) => (
                    <MoverCard key={f.slug} film={f} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </PagePlane>
    </Layout>
  );
}
