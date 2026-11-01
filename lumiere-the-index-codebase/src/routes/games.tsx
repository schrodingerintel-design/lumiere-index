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
          "Discover popular games, the Lumière games edit, and original guides across gaming culture.",
      },
    ],
    links: [canonicalLink("/games")],
  }),
  component: () => <CultureDirectory kind="games" />,
});
