import { createFileRoute } from "@tanstack/react-router";
import { CultureDirectory } from "@/components/lumiere/CultureDirectory";
import { canonicalLink } from "@/lib/site";
export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "Music · The Index" },
      {
        name: "description",
        content:
          "Explore music through original Lumière guides, source-linked profiles, and connections across culture.",
      },
    ],
    links: [canonicalLink("/music")],
  }),
  component: () => <CultureDirectory kind="music" />,
});
