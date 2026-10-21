import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installStaleDeployRecovery } from "@/lib/staleDeploy";
import { createQueryClient, hydrateFromDom } from "@/lib/queryClient";

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
  const queryClient = createQueryClient();

  // On the client, the server already ran the route loaders and shipped the
  // results inside the HTML. Restoring them here - before the first render -
  // means the browser paints the same content the server sent instead of
  // re-rendering it from scratch.
  hydrateFromDom(queryClient);

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
