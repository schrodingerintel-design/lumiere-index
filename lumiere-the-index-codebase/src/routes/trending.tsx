import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead, LiveStamp } from "@/components/lumiere/PageHead";
import { Skeleton } from "@/components/lumiere/Skeletons";
import { getTrendingFilms, type TrendingFilmOut } from "@/lib/apiClient";
import { posterAt } from "@/lib/tmdbImage";
import { RouteError } from "@/lib/route-error";

export const Route = createFileRoute("/trending")({
  head: () => ({
    meta: [
      { title: "Trending · The Index" },
      {
        name: "description",
        content:
          "Films generating the most audience conversation right now.",
      },
      ogUrlMeta("/trending"),
    ],
    links: [canonicalLink("/trending")],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["trending", "films"],
      queryFn: () => getTrendingFilms(20),
    });
  },
  component: TrendingPage,
  errorComponent: RouteError,
});

function TrendingRow({ film, position }: { film: TrendingFilmOut; position: number }) {
  const poster = posterAt(film.poster_url, "w342") || undefined;
  return (
    <li>
      <Link
        to="/films/$slug"
        params={{ slug: film.film_slug }}
        className="ix-row ix-row--trend"
      >
        <span className="ix-row__rk">{String(position).padStart(2, "0")}</span>
        <span className="ix-row__main">
          <span
            className="ix-row__art"
            style={{
              background: `linear-gradient(155deg, ${film.gradient_from ?? "#2a3140"}, ${film.gradient_to ?? "#131720"})`,
            }}
          >
            {poster ? (
              <img src={poster} alt={`${film.title} poster`} loading="lazy" decoding="async" />
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="ix-row__title block">{film.title}</span>
            <span className="ix-row__meta ix-row__meta--clamp">{film.trend_reason}</span>
          </span>
        </span>
        <span />
        <span className="ix-row__r">
          <span className="ix-row__num">#{film.rank}</span>
        </span>
      </Link>
    </li>
  );
}

function TrendingPage() {
  const { data: films, isLoading, error } = useQuery({
    queryKey: ["trending", "films"],
    queryFn: () => getTrendingFilms(20),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <PagePlane lead={films?.[0] ?? null}>
        <PageHead
          kicker="In Discussion"
          title="Trending"
          lede="What audiences are actively discussing right now."
          meta={<LiveStamp>Updated every 15 minutes</LiveStamp>}
        />

        <div className="ix-sec !pt-0">
          {error ? (
            <div className="ix-note">
              <p className="ix-note__title">Unable to load trending titles</p>
              <p className="ix-note__body">
                The chart engine did not answer. Please try again shortly.
              </p>
            </div>
          ) : isLoading ? (
            <ul className="ix-rows">
              {[...Array(8)].map((_, i) => (
                <li key={i} className="ix-row ix-row--trend">
                  <Skeleton className="h-5 w-8" />
                  <span className="ix-row__main">
                    <Skeleton className="ix-row__art" />
                    <span className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-40 max-w-full" />
                      <Skeleton className="h-3 w-64 max-w-full" />
                    </span>
                  </span>
                  <span />
                  <span className="ix-row__r">
                    <Skeleton className="h-3 w-10" />
                  </span>
                </li>
              ))}
            </ul>
          ) : films && films.length > 0 ? (
            <ul className="ix-rows">
              {films.map((film, i) => (
                <TrendingRow key={film.film_slug} film={film} position={i + 1} />
              ))}
            </ul>
          ) : (
            <div className="ix-note">
              <p className="ix-note__title">Nothing is trending yet</p>
              <p className="ix-note__body">
                Titles appear here once there is enough audience conversation to
                measure.
              </p>
            </div>
          )}
        </div>
      </PagePlane>
    </Layout>
  );
}
