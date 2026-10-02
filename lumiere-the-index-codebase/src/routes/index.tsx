import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { Layout } from "@/components/lumiere/Layout";
import { TopNav } from "@/components/lumiere/TopNav";
import { RouteError } from "@/lib/route-error";
import { HomeEnvironment } from "@/components/home/HomeEnvironment";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeRail } from "@/components/home/HomeRail";
import { HomeBand, type HomeCardFilm } from "@/components/home/HomeBand";
import { AdSlot } from "@/components/lumiere/AdSlot";
import { getTopFilms, getBiggestMovers, getIndexNewEntries } from "@/lib/apiClient";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Index · The charting system for film and television culture" },
      {
        name: "description",
        content:
          "The Index charts cultural momentum across film and television: Movie 100, TV 100, Biggest Movers and New Entries, refreshed every 15 minutes.",
      },
      ogUrlMeta("/"),
    ],
    links: [canonicalLink("/")],
  }),
  // Prefetch every query the home page renders so SSR serves real data.
  loader: async ({ context }) => {
    const { queryClient } = context;
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["films", "top", 100],
        queryFn: () => getTopFilms(100),
      }),
      queryClient.prefetchQuery({
        queryKey: ["films", "tv100", 4],
        queryFn: () => getTopFilms(4, 0, "TV_100"),
      }),
      queryClient.prefetchQuery({
        queryKey: ["index", "movers", 8],
        queryFn: () => getBiggestMovers(8),
      }),
      queryClient.prefetchQuery({
        queryKey: ["index", "new-entries"],
        queryFn: () => getIndexNewEntries(),
      }),
    ]);
  },
  component: Home,
  errorComponent: RouteError,
});

function Home() {
  const films = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });
  const tv = useQuery({
    queryKey: ["films", "tv100", 4],
    queryFn: () => getTopFilms(4, 0, "TV_100"),
    staleTime: 5 * 60 * 1000,
  });
  const movers = useQuery({
    queryKey: ["index", "movers", 8],
    queryFn: () => getBiggestMovers(8),
    staleTime: 5 * 60 * 1000,
  });
  const fresh = useQuery({
    queryKey: ["index", "new-entries"],
    queryFn: () => getIndexNewEntries(),
    staleTime: 5 * 60 * 1000,
  });

  const chart = films.data ?? [];
  // The hero is number 1 and nothing else, so the chart below it opens at #2.
  const lead = chart[0] ?? null;
  const below = chart.slice(1);

  const gainers: HomeCardFilm[] = (movers.data?.gainers ?? []).map((m) => ({
    slug: m.slug,
    title: m.title,
    poster_url: m.poster_url,
    rank: m.current_rank,
    movement: m.movement,
  }));

  const newEntries: HomeCardFilm[] = (fresh.data ?? []).map((f) => ({
    slug: f.slug,
    title: f.title,
    poster_url: f.poster_url,
    rank: null,
  }));

  return (
    // Home places the one header itself, inside the luminous plane, so the
    // composition is a single lit surface rather than a page with a chrome bar
    // bolted above it. See TopNav's `tone`.
    <Layout header={false}>
      <div className="ix-stage">
        <HomeEnvironment lead={lead} />

        <div className="ix-panel">
          <TopNav tone="panel" />
          {lead ? (
            <>
              <HomeHero film={lead} />
              <HomeRail />

              <HomeBand
                title="Movie 100"
                sub="What’s taking over · updates every 15 minutes"
                to="/top-100"
                toLabel="All 100"
                items={below.slice(0, 6)}
              />
              {/* Future ad: home-after-top10 — after the primary ranking
                  experience. Never inside the hero or under the #1 title.
                  Renders nothing while advertising is disabled. */}
              <AdSlot placement="home-after-top10" />
              <HomeBand
                title="On the rise"
                sub="The steepest climbs in the last 24 hours"
                to="/rising"
                toLabel="All movers"
                items={gainers.slice(0, 6)}
                defer
              />
              <HomeBand
                title="TV 100"
                sub="What’s holding"
                to="/tv-100"
                toLabel="All 100"
                items={tv.data ?? []}
                columns={4}
                defer
              />
              <HomeBand
                title="New entries"
                sub="Entered the chart this week"
                to="/new-entries"
                toLabel="All entries"
                items={newEntries.slice(0, 4)}
                columns={4}
                defer
              />
              {/* Future ad: home-secondary — far down the page between
                  discovery sections. Renders nothing while ads are disabled. */}
              <AdSlot placement="home-secondary" />
              <HomeBand title="The deep chart" sub="#21 — #48" items={below.slice(19, 31)} defer />
            </>
          ) : (
            <div className="ix-panel__waiting">
              <span className="ix-kicker">The Index · Live</span>
              <h2 className="ix-waiting__title">Chart reconnecting</h2>
              <p className="ix-waiting__body">
                Live rankings are temporarily unavailable. The Index refreshes every 15
                minutes; this page recovers automatically once the chart engine is back.
              </p>
            </div>
          )}
        </div>

        {/* The panel dissolves into the page's own black, and the footer that
            follows sits on that same black — the background every other page
            in The Index uses. */}
        <div className="ix-seam" aria-hidden="true" />
      </div>
    </Layout>
  );
}
