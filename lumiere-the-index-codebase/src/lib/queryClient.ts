import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";

/**
 * Server -> client query cache handoff.
 *
 * The server renders route loaders' prefetched data straight into the HTML.
 * Without a handoff, the browser's first render has an empty cache, so React
 * renders loading skeletons, the markup does not match the server HTML, and
 * React throws the whole tree away and re-renders - the visitor sees a flash
 * of skeletons over content that was already on the page.
 *
 * The fix: serialize the server's cache into the HTML, then restore it on the
 * client before the first render. The payload is written into a
 * `type="application/json"` script, so it is inert (never executed) and the
 * client reads the exact same string back out of the DOM, which keeps the
 * server and client markup byte-identical.
 */

/** DOM id of the script that carries the serialized cache. */
export const QUERY_STATE_ELEMENT_ID = "tsr-query-state";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Rankings only refresh every 12 hours - a 5-minute client cache means
        // navigating back to a page is instant instead of refetching.
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

/**
 * Serialize the server's cache for transport in the HTML.
 * Returns an empty string when there is nothing worth sending.
 */
export function dehydrateToJson(queryClient: QueryClient): string {
  const state = dehydrate(queryClient);
  if (!state.queries?.length) return "";
  // "<" is escaped so a title can never close the script element early.
  return JSON.stringify(state).replace(/</g, "\\u003c");
}

/**
 * Restore the server's cache on the client. Runs before the first render, so
 * the client's first paint matches the server HTML exactly.
 */
export function hydrateFromDom(queryClient: QueryClient): void {
  if (typeof document === "undefined") return;
  const element = document.getElementById(QUERY_STATE_ELEMENT_ID);
  const json = element?.textContent;
  if (!json) return;
  try {
    hydrate(queryClient, JSON.parse(json) as DehydratedState);
  } catch (error) {
    console.warn("[query] could not restore the server cache", error);
  }
}
