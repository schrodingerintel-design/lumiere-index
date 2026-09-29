import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { RouteError } from "@/lib/route-error";
import { AdSlot } from "@/components/lumiere/AdSlot";
import { SearchModal } from "@/components/lumiere/SearchModal";
import { Footer } from "@/components/lumiere/Footer";
import {
  getBiggestMovers,
  getGenres,
  getIndexNewEntries,
  getTopFilms,
  getTrendingFilms,
  getWeeklyTop100,
} from "@/lib/apiClient";

import { BetaNav, MobileTabBar } from "@/components/beta2/BetaNav";
import { NowHero } from "@/components/beta2/NowHero";
import { TopTen } from "@/components/beta2/TopTen";
import {
  ChartEntryPanels,
  GenreDiscovery,
  MoversModule,
  NewEntriesModule,
  SurgingRail,
  WeeklySpotlight,
} from "@/components/beta2/Modules";
import { ChartsUnavailable, HeroSkeleton } from "@/components/beta2/States";

/**
 * Beta 2.0 homepage.
 *
 * The architecture (loader prefetch, SEO head, canonical, ad placements,
 * route error boundary) is deliberately identical to the 1.x route it replaces
 * — only the presentation layer is new. Nothing about data fetching, SEO or
 * the error path changed as part of the redesign.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Index · What matters right now" },
      {
        name: "description",
        content:
          "The Index charts cultural momentum across film and television: Movie 100, TV 100, Weekly 100, Biggest Movers and New Entries, refreshed every 15 minutes.",
      },
      ogUrlMeta("/"),
    ],
    links: [canonicalLink("/")],
  }),
  // Unchanged from 1.x in intent — every homepage query is fetched during SSR
  // so the server sends real data. The one addition is that the resolved values
  // are RETURNED, not just parked in the server's query cache.
  //
  // The server query cache is not serialised into the page, so on the client's
  // very first render every useQuery() below saw `isLoading === true` while the
  // server had already rendered the full page. That is a hydration mismatch:
  // React discards the server HTML and re-renders, so the hero visibly
  // repaints from real content back to a skeleton. Returning the data makes
  // the router dehydrate it, and `initialData` below makes the first client
  // render identical to the first server render.
  //
  // What we fetch is deliberately NOT what we serialise.
  //
  // The homepage renders the Top 10 and nothing more, so it asks the API for
  // ten films under its OWN cache key rather than borrowing the shared
  // ["films","top",100] entry. Two reasons, and the second is the important
  // one:
  //
  //   1. Volume. A hundred ranked films — each with a synopsis — was being
  //      serialised into a 268 KB HTML document. On a phone that document is
  //      the request blocking every other request.
  //   2. Correctness. A ten-item result stored under the hundred-item key
  //      would satisfy the Top 100 page's `useQuery` for its whole staleTime
  //      window, and that page would silently render ten rows. Separate keys,
  //      separate caches, no cross-contamination.
  loader: async ({ context }) => {
    const { queryClient } = context;

    const [top, tv, movers, newEntries, trending, weekly, genres] =
      await Promise.all([
        getTopFilms(10),
        getTopFilms(5, 0, "TV_100"),
        getBiggestMovers(6),
        getIndexNewEntries(8),
        getTrendingFilms(4),
        getWeeklyTop100(),
        getGenres(),
      ]);

    // Warm the shared caches the OTHER routes read, unchanged. The homepage
    // itself never reads these back, so there is no way for the trimmed
    // payloads above to leak into a chart page.
    queryClient.setQueryData(["films", "tv100", 10], tv);
    queryClient.setQueryData(["index", "movers"], movers);
    queryClient.setQueryData(["index", "new-entries"], newEntries);
    queryClient.setQueryData(["trending", "films"], trending);
    queryClient.setQueryData(["index", "weekly"], weekly);
    queryClient.setQueryData(["genres"], genres);

    return {
      top,
      tv,
      movers,
      newEntries,
      trending,
      // Weekly is used for exactly one thing on the homepage: the #1 title
      // and the week label. Shipping a hundred weekly entries to show one
      // poster is not a trade worth making.
      weekly: {
        meta: weekly?.meta,
        entries: weekly?.entries?.slice(0, 1) ?? [],
      },
      genres,
    };
  },
  component: Home,
  errorComponent: RouteError,
});

function Home() {
  const [searchOpen, setSearchOpen] = useState(false);

  // `initialData` is the hydration contract: on the first client render the
  // component must produce exactly what the server produced. Without it the
  // skeleton branch wins on the client and React throws away the server HTML.
  const initial = Route.useLoaderData();

  const { data: films, isLoading, error, refetch } = useQuery({
    queryKey: ["home", "top", 10],
    queryFn: () => getTopFilms(10),
    initialData: initial.top,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tvFilms } = useQuery({
    queryKey: ["films", "tv100", 10],
    queryFn: () => getTopFilms(5, 0, "TV_100"),
    initialData: initial.tv,
    staleTime: 5 * 60 * 1000,
  });

  const { data: movers } = useQuery({
    queryKey: ["index", "movers"],
    queryFn: () => getBiggestMovers(6),
    initialData: initial.movers,
    staleTime: 5 * 60 * 1000,
  });

  const { data: newEntries } = useQuery({
    queryKey: ["index", "new-entries"],
    queryFn: () => getIndexNewEntries(8),
    initialData: initial.newEntries,
    staleTime: 5 * 60 * 1000,
  });

  const { data: trending } = useQuery({
    queryKey: ["trending", "films"],
    queryFn: () => getTrendingFilms(4),
    initialData: initial.trending,
    staleTime: 5 * 60 * 1000,
  });

  const { data: weekly } = useQuery({
    queryKey: ["index", "weekly"],
    queryFn: () => getWeeklyTop100(),
    initialData: initial.weekly,
    staleTime: 30 * 60 * 1000,
  });

  const { data: genres } = useQuery({
    queryKey: ["genres"],
    queryFn: () => getGenres(),
    initialData: initial.genres,
    staleTime: 60 * 60 * 1000,
  });

  // "Surging" is only ever the titles the backend itself marked SURGING, or
  // the strongest climbers from the movers feed. Never a guess.
  const surging = [
    ...(trending ?? [])
      .slice(0, 4)
      .map((t) => ({
        title: t.title,
        slug: t.film_slug,
        rank: t.rank,
        poster_url: t.poster_url,
        gradient_from: t.gradient_from,
        gradient_to: t.gradient_to,
      })),
    ...(movers?.gainers ?? []).slice(0, 6).map((g) => ({
      title: g.title,
      slug: g.slug,
      rank: g.current_rank,
      poster_url: g.poster_url,
      gradient_from: g.gradient_from,
      gradient_to: g.gradient_to,
      movement: g.movement,
    })),
  ].slice(0, 10);

  const weeklyLeader = weekly?.entries?.[0]
    ? {
        title: weekly.entries[0].title,
        slug: weekly.entries[0].slug,
        rank: weekly.entries[0].rank,
        poster_url: weekly.entries[0].poster_url,
        gradient_from: weekly.entries[0].gradient_from,
        gradient_to: weekly.entries[0].gradient_to,
      }
    : null;

  const topFilms = films ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[#070708]">
      <BetaNav onSearch={() => setSearchOpen(true)} />

      <main className="flex-1 pb-20 md:pb-0">
        {/* ── Hero: what matters right now ────────────────────────────── */}
        {!films ? (
          error ? (
            <ChartsUnavailable onRetry={() => void refetch()} />
          ) : isLoading ? (
            <HeroSkeleton />
          ) : null
        ) : (
          <NowHero films={topFilms} />
        )}

        {/* ── Top 10 ──────────────────────────────────────────────────── */}
        {films ? <TopTen films={topFilms} /> : null}

        {/* Ad: after the primary ranking experience, never inside the hero
            or Top 10 (§16). Renders nothing while advertising is off. */}
        <AdSlot placement="home-after-top10" />

        {/* ── Discovery modules, each with its own visual rhythm ──────── */}
        <SurgingRail films={surging} />
        <MoversModule films={(movers?.gainers ?? []).slice(0, 6)} />
        <NewEntriesModule films={(newEntries ?? []).slice(0, 8)} />

        {/* Ad: far down the page, between discovery sections. */}
        <AdSlot placement="home-secondary" />

        <ChartEntryPanels
          movies={topFilms.slice(0, 5)}
          tv={(tvFilms ?? []).slice(0, 5)}
        />
        <WeeklySpotlight leader={weeklyLeader} weekLabel={weekly?.meta?.week_start} />
        <GenreDiscovery genres={genres ?? []} />

        <section className="fold-defer mx-auto w-full max-w-canvas px-5 pb-16 sm:px-8 lg:px-14">
          <Link
            to="/methodology"
            className="focus-ring inline-flex min-h-11 items-center rounded-b2-sm border border-line px-5 text-[14px] font-medium text-[#A8A6A1] transition-colors hover:border-violet/40 hover:text-paper"
          >
            How The Index works
          </Link>
        </section>
      </main>

      <Footer />
      <MobileTabBar onSearch={() => setSearchOpen(true)} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
