import { createFileRoute } from "@tanstack/react-router";
import { CultureDirectory } from "@/components/lumiere/CultureDirectory";
import { canonicalLink } from "@/lib/site";
export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Games · The Index" },
      {
        name: "description",
        content:
          "Explore games through original Lumière guides, source-linked profiles, and connections across culture.",
      },
    ],
    links: [canonicalLink("/games")],
  }),
  component: () => <CultureDirectory kind="games" />,
});
