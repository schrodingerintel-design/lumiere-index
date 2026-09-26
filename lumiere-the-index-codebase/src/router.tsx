import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installStaleDeployRecovery } from "@/lib/staleDeploy";

/**
 * Stale-deploy recovery.
 *
 * Detection lives in `@/lib/staleDeploy` and runs at the ERROR-BOUNDARY level,
 * not on `unhandledrejection`: TanStack Router catches chunk-load rejections
 * internally and renders its error boundary, so an unhandledrejection listener
 * never saw the failure and the old safety net was inoperative. The boundaries
 * (root ErrorComponent + RouteError) now call recoverFromStaleDeploy(), which
 * reloads once per session with a cache-bypassing query param and otherwise
 * lets the normal boundary render.
 *
 * installStaleDeployRecovery() only exposes window.__staleDeploy for manual
 * debugging in production.
 */

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
