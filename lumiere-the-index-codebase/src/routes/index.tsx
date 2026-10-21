import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { Layout } from "@/components/lumiere/Layout";
import { GenreSections } from "@/components/lumiere/GenreSections";
import { AdSlot } from "@/components/lumiere/AdSlot";
import { HomeIntro, TrendingRail, TodaysIndex } from "@/components/lumiere/Discovery";
import { FrontPage } from "@/components/lumiere/FrontPage";
import { ComingSoon } from "@/components/lumiere/ComingSoon";
import { PulseRow } from "@/components/lumiere/Hero";
import { RouteError } from "@/lib/route-error";
import {
  getBiggestMovers,
  getMetaRefresh,
  getTopFilms,
  getRisingFilms,
  getTrendingFilms,
  getWeeklyTop100,
  getIndexNewEntries,
  getNowPlayingReleases,
  getUpcomingReleases,
} from "@/lib/apiClient";

/** The home page renders the top 10 of the Movie 100 — ten titles, not the
 *  whole chart. Fetching only what is shown keeps the first paint (and the
 *  HTML that carries it) light. The full chart is fetched on /top-100. */
const HOME_CHART_SIZE = 10;

/** Rising titles that headline the front-page hero. */
const FRONT_HERO_COUNT = 5;

/** TMDB pages merged for the release calendar. */
const UPCOMING_PAGES = 5;
const NOW_PLAYING_PAGES = 2;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Index · The charting system for film and television culture" },
      {
        name: "description",
        content:
          "The Index charts cultural momentum across film and television: Movie 100, TV 100, Biggest Movers and New Entries, refreshed every 12 hours.",
      },
      ogUrlMeta("/"),
    ],
    links: [canonicalLink("/")],
  }),
  // Prefetch every query the home page renders so SSR serves real data. Each
  // key must match the consuming component exactly; a failed section degrades
  // to its own skeleton/retry state without blocking the page.
  loader: async ({ context }) => {
    const { queryClient } = context;
    await Promise.all([
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
        queryKey: ["films", "rising", FRONT_HERO_COUNT],
        queryFn: () => getRisingFilms(FRONT_HERO_COUNT),
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
      queryClient.prefetchQuery({
        queryKey: ["index", "new-entries"],
        queryFn: () => getIndexNewEntries(),
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

const CHART_LINKS = [
  { to: "/top-100", label: "Movie 100" },
  { to: "/tv-100", label: "TV 100" },
  { to: "/weekly-100", label: "Weekly 100" },
  { to: "/rising", label: "Biggest Movers" },
  { to: "/new-entries", label: "New Entries" },
] as const;

function ChartNav() {
  // Desktop only. The hamburger-driven MobileMenu in TopNav owns chart
  // navigation on phones, so the homepage reuses that surface instead of
  // stacking a second strip the user has to scroll past.
  return (
    <nav
      aria-label="Chart sections"
      className="mx-auto hidden max-w-[90rem] border-y border-foreground/10 px-6 lg:flex lg:items-stretch xl:px-8"
    >
      {CHART_LINKS.map((link, index) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: true }}
          activeProps={{
            className:
              "text-foreground after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-primary after:content-[''] xl:after:left-6 xl:after:right-6",
          }}
          className={`group relative flex min-h-14 flex-1 items-center justify-between px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground xl:px-6 ${
            index > 0 ? "border-l border-foreground/10" : ""
          }`}
        >
          <span>{link.label}</span>
          <span className="text-[10px] text-foreground/30 transition-colors group-hover:text-primary" aria-hidden>
            ↗
          </span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * The Index 1.0 homepage. Desktop opens with a chart nav rail beneath the
 * masthead; on mobile the page flows straight from the front-page hero into
 * discovery — the hamburger menu owns chart navigation on phones.
 */
function Home() {
  return (
    <Layout>
      <ChartNav />
      <FrontPage />
      <HomeIntro />
      <TrendingRail />
      <div className="home-desktop-composition">
        <TodaysIndex />
        {/* The rail carries new entries only: the front-page hero owns
            Biggest Movers in its side rail, and trending artwork lives in
            the poster rail above — no duplicated column anywhere. */}
        <PulseRow rail showTrending={false} hideMovers />
      </div>
      {/* Future ad: home-after-top10 — after the primary ranking experience.
          Never inside the discovery opening or inside Today's Index.
          Renders nothing while advertising is disabled. */}
      <AdSlot placement="home-after-top10" />
      {/* Future ad: home-secondary — far down the page between discovery
          sections. Renders nothing while advertising is disabled. */}
      <AdSlot placement="home-secondary" />
      <ComingSoon />
      <GenreSections />
    </Layout>
  );
}
