import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/lumiere/Layout";
import { RouteError } from "@/lib/route-error";
import { Hero } from "@/components/lumiere/Hero";
import { Top100Section } from "@/components/lumiere/Top100Section";
import { PulseRow } from "@/components/lumiere/Pulse";
import { GenreSections } from "@/components/lumiere/GenreSections";
import { QuoteBanner } from "@/components/lumiere/QuoteBanner";
import {
  getNewReleaseFilms,
  getLiveStats,
} from "@/lib/apiClient";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumière The Index — The films the world can't stop talking about" },
      {
        name: "description",
        content:
          "The daily cultural momentum ranking for cinema. The 100 films currently generating the strongest audience conversation, attention and visibility.",
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
    ]);
  },
  component: Home,
  errorComponent: RouteError,
});

function Home() {
  // Homepage rhythm — the story the page tells:
  // What's #1 → the full chart → what's moving → what to explore.
  return (
    <Layout>
      <Hero />
      <Top100Section />
      <PulseRow />
      <GenreSections />
      <QuoteBanner />
    </Layout>
  );
}
