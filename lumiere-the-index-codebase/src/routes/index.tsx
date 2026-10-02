import { Link, createFileRoute } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { Layout } from "@/components/lumiere/Layout";
import { RouteError } from "@/lib/route-error";
import { Hero, TopTen, TvTopFive, PulseRow } from "@/components/lumiere/Hero";
import { GenreSections } from "@/components/lumiere/GenreSections";
import { AdSlot } from "@/components/lumiere/AdSlot";
import { getTopFilms } from "@/lib/apiClient";

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
        queryKey: ["films", "tv100", 5],
        queryFn: () => getTopFilms(5, 0, "TV_100"),
      }),
      queryClient.prefetchQuery({
        queryKey: ["index", "movers"],
        queryFn: () => import("@/lib/apiClient").then((m) => m.getBiggestMovers()),
      }),
      queryClient.prefetchQuery({
        queryKey: ["index", "new-entries"],
        queryFn: () => import("@/lib/apiClient").then((m) => m.getIndexNewEntries()),
      }),
      queryClient.prefetchQuery({
        queryKey: ["trending", "films"],
        queryFn: () => import("@/lib/apiClient").then((m) => m.getTrendingFilms(6)),
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

function Home() {
  // The page reads as a live publication: leader, chart sections, then the
  // supporting intelligence that explains what changed around the chart.
  return (
    <Layout>
      <Hero />
      <ChartNav />
      <div className="home-desktop-composition">
        <TopTen />
        <PulseRow rail />
      </div>
      {/* Future ad: home-after-top10 — after the primary ranking experience.
          Never inside the hero, under the #1 title, or inside Top 10.
          Renders nothing while advertising is disabled. */}
      <AdSlot placement="home-after-top10" />
      <TvTopFive />
      {/* Future ad: home-secondary — far down the page between discovery
          sections. Renders nothing while advertising is disabled. */}
      <AdSlot placement="home-secondary" />
      <GenreSections />
    </Layout>
  );
}
