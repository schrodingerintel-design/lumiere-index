import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { Layout } from "@/components/lumiere/Layout";
import { GenreSections } from "@/components/lumiere/GenreSections";
import { AdSlot } from "@/components/lumiere/AdSlot";
import { HomeIntro, TrendingRail, TodaysIndex } from "@/components/lumiere/Discovery";
import { PulseRow } from "@/components/lumiere/Hero";
import { RouteError } from "@/lib/route-error";
import {
  getBiggestMovers,
  getMetaRefresh,
  getTopFilms,
  getTrendingFilms,
  getWeeklyTop100,
  getIndexNewEntries,
} from "@/lib/apiClient";

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
        queryKey: ["films", "top", 100],
        queryFn: () => getTopFilms(100),
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
  return (
    <nav
      aria-label="Chart sections"
      className="mx-auto hidden max-w-[90rem] border-y border-foreground/10 px-6 lg:flex lg:items-stretch xl:px-8"
    >
      {CHART_LINKS.map((link, index) => (
        <Link
          key={link.to}
          to={link.to}
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
 * The Index 1.0 homepage — discovery-first, no oversized hero. The first
 * viewport carries the compact intro, the trending poster rail and the chart
 * tabs; rankings remain the spine, with movers, new entries and genre rails
 * layered below. Every section owns its data and its failure states, and all
 * displayed figures come from the existing chart endpoints.
 */
function Home() {
  return (
    <Layout>
      <ChartNav />
      <HomeIntro />
      <TrendingRail />
      <div className="home-desktop-composition">
        <TodaysIndex />
        {/* The rail carries movers + new entries only: trending artwork lives
            in the poster rail above, so the two never duplicate. */}
        <PulseRow rail showTrending={false} />
      </div>
      {/* Future ad: home-after-top10 — after the primary ranking experience.
          Never inside the discovery opening or inside Today's Index.
          Renders nothing while advertising is disabled. */}
      <AdSlot placement="home-after-top10" />
      {/* Future ad: home-secondary — far down the page between discovery
          sections. Renders nothing while advertising is disabled. */}
      <AdSlot placement="home-secondary" />
      <GenreSections />
    </Layout>
  );
}
