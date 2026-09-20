import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Stale-deploy recovery.
 *
 * When a deploy lands, previously-served index.html keeps referencing hashed
 * JS chunks that no longer exist. A tab opened before the deploy then fails
 * its next lazy-chunk fetch (dynamic import rejection) and the route renders
 * blank. This listener catches that exact failure mode and reloads the page
 * once per session so the browser picks up the fresh bundle. The sessionStorage
 * guard prevents a reload loop if the new bundle is also missing something.
 */
function installStaleDeployRecovery() {
  if (import.meta.env.PROD === false || typeof window === "undefined") return;
  const STALE_KEY = "lumiere_stale_deploy_reload";
  window.addEventListener("unhandledrejection", (e) => {
    const reason: unknown = e?.reason;
    const msg =
      reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
    if (
      /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
        msg,
      )
    ) {
      e.preventDefault?.();
      if (!sessionStorage.getItem(STALE_KEY)) {
        sessionStorage.setItem(STALE_KEY, "1");
        window.location.reload();
      }
    }
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Rankings only refresh every 15 min — a 5-minute client cache means
        // navigating back to a page is instant instead of refetching.
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  installStaleDeployRecovery();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route loaders (and their queries) when a link is hovered, so
    // navigation feels instant.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
