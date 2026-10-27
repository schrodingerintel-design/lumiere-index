import { CultureHighlights } from "@/components/lumiere/CultureHighlights";
import { getPeople } from "@/lib/catalog";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { canonicalLink, titleSocialMeta } from "@/lib/site";
import { Layout } from "@/components/lumiere/Layout";
import { GenreSections } from "@/components/lumiere/GenreSections";
import { AdSlot } from "@/components/lumiere/AdSlot";
import { TodaysIndex } from "@/components/lumiere/Discovery";
import { SocialDiscovery } from "@/components/lumiere/SocialDiscovery";
import { ComingSoon } from "@/components/lumiere/ComingSoon";
import { RouteError } from "@/lib/route-error";
import {
  getBiggestMovers,
  getMetaRefresh,
  getTopFilms,
  getTrendingFilms,
  getWeeklyTop100,
  getNowPlayingReleases,
  getUpcomingReleases,
} from "@/lib/apiClient";

/** The home page renders the top 10 of the Movie 100 — ten titles, not the
 *  whole chart. Fetching only what is shown keeps the first paint (and the
 *  HTML that carries it) light. The full chart is fetched on /top-100. */
const HOME_CHART_SIZE = 10;

/** TMDB pages merged for the release calendar. */
const UPCOMING_PAGES = 5;
const NOW_PLAYING_PAGES = 2;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Index · Film, TV, games, music & culture" },
      {
        name: "description",
        content:
          "Discover film, television, people, games, creators, and music. Explore stories, credits, original guides, and audience charts.",
      },
      ...titleSocialMeta(
        "Film, TV, games, music & culture",
        "Discover titles, people, original culture guides, and the Lumière charts.",
        "/",
      ),
    ],
    links: [canonicalLink("/")],
  }),
  // Prefetch every query the home page renders so SSR serves real data. Each
  // key must match the consuming component exactly; a failed section degrades
  // to its own skeleton/retry state without blocking the page.
  loader: async ({ context }) => {
    const { queryClient } = context;
    await Promise.all([
      queryClient.prefetchQuery({ queryKey: ["people", "week", 1], queryFn: () => getPeople() }),
      queryClient.prefetchQuery({
        queryKey: ["meta", "refresh"],
        queryFn: () => getMetaRefresh(),
      }),
      queryClient.prefetchQuery({
        queryKey: ["trending", "home", 12],
        queryFn: () => getTrendingFilms(12),
      }),
      queryClient.prefetchQuery({
        queryKey: ["films", "top", HOME_CHART_SIZE],
        queryFn: () => getTopFilms(HOME_CHART_SIZE),
      }),
      queryClient.prefetchQuery({
        queryKey: ["films", "tv100", 10],
        queryFn: () => getTopFilms(10, 0, "TV_100"),
      }),
      queryClient.prefetchQuery({
        queryKey: ["weekly", "top100"],
        queryFn: () => getWeeklyTop100(),
      }),
      queryClient.prefetchQuery({
        queryKey: ["index", "movers"],
        queryFn: () => getBiggestMovers(),
      }),
      // The release calendar below the charts - prefetched so the day
      // columns are populated in the server-rendered HTML.
      queryClient.prefetchQuery({
        queryKey: ["tmdb", "releases", "upcoming", UPCOMING_PAGES],
        queryFn: () => getUpcomingReleases(UPCOMING_PAGES),
      }),
      queryClient.prefetchQuery({
        queryKey: ["tmdb", "releases", "now_playing", NOW_PLAYING_PAGES],
        queryFn: () => getNowPlayingReleases(NOW_PLAYING_PAGES),
      }),
    ]);
  },
  component: Home,
  errorComponent: RouteError,
});

function Home() {
  const chart = useQuery({
    queryKey: ["films", "top", HOME_CHART_SIZE],
    queryFn: () => getTopFilms(HOME_CHART_SIZE),
    staleTime: 300000,
  });
  return (
    <Layout>
      <SocialDiscovery />
      <CultureHighlights />
      <div className="community-charts">
        <TodaysIndex />
      </div>
      {!!chart.data?.length && <AdSlot placement="home-after-top10" />}
      <ComingSoon />
      <GenreSections />
    </Layout>
  );
}
