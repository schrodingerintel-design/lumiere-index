import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "@/routeTree.gen";

describe("catalog detail navigation", () => {
  it("opens a person without rendering the people directory as a parent", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
      history: createMemoryHistory({ initialEntries: ["/people/287"] }),
    });
    const matches = router.matchRoutes("/people/287");
    expect(matches.at(-1)?.params).toMatchObject({ id: "287" });
    expect(matches.some((match) => match.routeId === "/people")).toBe(false);
    expect(matches.at(-1)?.fullPath).toBe("/people/$id");
  });
});
