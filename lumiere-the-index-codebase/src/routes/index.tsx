import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/lumiere/Layout";
import { RouteError } from "@/lib/route-error";
import { Hero, TopTen, PulseRow } from "@/components/lumiere/Hero";
import { GenreSections } from "@/components/lumiere/GenreSections";
import { getTopFilms } from "@/lib/apiClient";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumière The Index — The titles capturing the most cultural attention" },
      {
        name: "description",
        content:
          "The Index is a daily measure of what's capturing cultural attention across film and television.",
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
  // Homepage rhythm — the story the page tells:
  // What's #1 → the chart → what's moving / new / discussed → what to explore.
  return (
    <Layout>
      <Hero />
      <TopTen />
      <PulseRow />
      <GenreSections />
    </Layout>
  );
}
