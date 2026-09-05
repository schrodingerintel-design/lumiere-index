import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/lumiere/Layout";
import { RouteError } from "@/lib/route-error";
import { Hero } from "@/components/lumiere/Hero";
import { Top100Section } from "@/components/lumiere/Top100Section";
import { EditorialInsight } from "@/components/lumiere/EditorialInsight";
import { PulseRow } from "@/components/lumiere/Pulse";
import { GenreSections } from "@/components/lumiere/GenreSections";
import { QuoteBanner } from "@/components/lumiere/QuoteBanner";
import {
  getNewReleaseFilms,
  getTrendingFilms,
  getLiveStats,
} from "@/lib/apiClient";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumière The Index — The films the world can't stop talking about" },
      {
        name: "description",
        content:
          "Highest-rated new releases ranked in real time. The cultural intelligence platform for cinema.",
      },
    ],
  }),
  // Prefetch every query the home page renders (Hero, Top100Section, PulseRow,
  // GenreSections) so SSR serves real film data instead of skeleton screens.
  loader: async ({ context }) => {
    const { queryClient } = context;
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["stats", "live"],
        queryFn: getLiveStats,
      }),
      queryClient.prefetchQuery({
        queryKey: ["films", "new-releases", 100],
        queryFn: () => getNewReleaseFilms(100),
      }),
      // 20 not 6: /trending needs 20 and PulseRow slices its share anyway.
      queryClient.prefetchQuery({
        queryKey: ["trending", "films"],
        queryFn: () => getTrendingFilms(20),
      }),
    ]);
  },
  component: Home,
  errorComponent: RouteError,
});

function Home() {
  const { data: trendingFilms = [] } = useQuery({
    queryKey: ["trending", "films"],
    queryFn: () => getTrendingFilms(20),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <Hero />
      <EditorialInsight films={trendingFilms.slice(0, 3)} />
      <Top100Section />
      <PulseRow />
      <GenreSections />
      <QuoteBanner />
    </Layout>
  );
}
