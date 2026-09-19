import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/lumiere/Layout";
import { RouteError } from "@/lib/route-error";
import { Hero, TopTen, TvTopFive, PulseRow } from "@/components/lumiere/Hero";
import { GenreSections } from "@/components/lumiere/GenreSections";
import { getTopFilms } from "@/lib/apiClient";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Index — The charting system for film and television culture" },
      {
        name: "description",
        content:
          "The Index charts cultural momentum across film and television: Movie 100, TV 100, Biggest Movers and New Entries, refreshed every 15 minutes.",
      },
    ],
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

function Home() {
  // Homepage rhythm — the story the page tells (charts are the product):
  // What's #1 → Movie 100 → TV 100 → what's moving / new / discussed → explore.
  return (
    <Layout>
      <Hero />
      <TopTen />
      <TvTopFive />
      <PulseRow />
      <GenreSections />
    </Layout>
  );
}
