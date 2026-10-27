import { createFileRoute } from "@tanstack/react-router";
import { ScreenBrowse } from "@/components/lumiere/ScreenBrowse";
import { getCatalog } from "@/lib/catalog";
import { canonicalLink } from "@/lib/site";
export const Route = createFileRoute("/movies")({
  head: () => ({
    meta: [
      { title: "Films · The Index" },
      {
        name: "description",
        content:
          "Browse trending, popular, and top-rated films, with credits, trailers, and related titles.",
      },
    ],
    links: [canonicalLink("/movies")],
  }),
  loader: ({ context }) =>
    context.queryClient.prefetchQuery({
      queryKey: ["catalog", "movie", "trending", 1],
      queryFn: () => getCatalog("movie"),
    }),
  component: () => <ScreenBrowse type="movie" />,
});
