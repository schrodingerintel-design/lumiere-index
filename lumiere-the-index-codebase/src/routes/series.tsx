import { createFileRoute } from "@tanstack/react-router";
import { ScreenBrowse } from "@/components/lumiere/ScreenBrowse";
import { getCatalog } from "@/lib/catalog";
import { canonicalLink } from "@/lib/site";
export const Route = createFileRoute("/series")({
  head: () => ({
    meta: [
      { title: "TV series · The Index" },
      {
        name: "description",
        content:
          "Browse trending, popular, and top-rated tv series, with credits, trailers, and related titles.",
      },
    ],
    links: [canonicalLink("/series")],
  }),
  loader: ({ context }) =>
    context.queryClient.prefetchQuery({
      queryKey: ["catalog", "tv", "trending", 1],
      queryFn: () => getCatalog("tv"),
    }),
  component: () => <ScreenBrowse type="tv" />,
});
