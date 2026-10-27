import { createFileRoute } from "@tanstack/react-router";
import { canonicalLink, titleSocialMeta } from "@/lib/site";
import { Layout } from "@/components/lumiere/Layout";
import { BuzzFeed } from "@/components/lumiere/BuzzFeed";
import { getTrendingFilms } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
export const Route = createFileRoute("/trending")({
  head: () => ({
    meta: titleSocialMeta(
      "Lumière Buzz",
      "Explore the films and stories generating recorded activity across Lumière’s tracked sources.",
      "/trending",
    ),
    links: [canonicalLink("/trending")],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["trending", "films", 200],
      queryFn: () => getTrendingFilms(200),
    });
  },
  component: () => (
    <Layout>
      <div className="catalog-page buzz-page">
        <header className="buzz-page-intro">
          <span className="eyebrow">Follow the conversation</span>
          <h1>
            All the buzz<span>.</span>
          </h1>
          <p>Find a story. Get into it. Pass it on.</p>
        </header>
        <BuzzFeed />
      </div>
    </Layout>
  ),
  errorComponent: RouteError,
});
