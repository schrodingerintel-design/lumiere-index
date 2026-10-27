import { createFileRoute } from "@tanstack/react-router";
import { CultureDirectory } from "@/components/lumiere/CultureDirectory";
import { canonicalLink } from "@/lib/site";
export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title: "Creators · The Index" },
      {
        name: "description",
        content:
          "Explore creators through original Lumière guides, source-linked profiles, and connections across culture.",
      },
    ],
    links: [canonicalLink("/creators")],
  }),
  component: () => <CultureDirectory kind="creators" />,
});
