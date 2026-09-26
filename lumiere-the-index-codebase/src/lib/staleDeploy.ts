/**
 * Stale-deploy recovery.
 *
 * On Vercel, an index.html served before a deploy references immutable,
 * content-hashed assets. When a new deploy promotes, those assets can 404 —
 * the tab is left holding dead URLs, a route chunk fails to load, and the
 * error boundary fires. The only recovery until now was the boundary's manual
 * "Try again" button.
 *
 * What this module does:
 *
 *   1. DETECT — match the error against known chunk-load failure signatures.
 *      Deliberately narrow: an arbitrary application exception (a bad map
 *      read, a null deref) is NOT a stale deploy, and treating it as one
 *      would reload the user while hiding the real bug.
 *   2. RECOVER — one cache-bypassing reload, so the browser re-fetches
 *      index.html and lands on the current deployment's assets.
 *   3. GUARD — a session-scoped flag prevents reload loops: if the fresh page
 *      also fails, the normal error boundary renders instead of refreshing
 *      again, and the failure is logged as genuine.
 *
 * Logging is structured so platform logs can distinguish the two:
 *
 *   [stale-deploy] {"action":"recovering", ...} → matched, reloading now
 *   [stale-deploy] {"action":"reload",     ...} → reload issued
 *   [stale-deploy] {"action":"blocked",    ...} → already tried this session
 *   [stale-deploy] {"action":"none",       ...} → not a chunk failure
 *
 * The previous implementation listened on `unhandledrejection`, but the router
 * catches chunk-load rejections internally and renders its error boundary, so
 * that event never fired and the safety net was inoperative. Detection now
 * happens at the error-boundary level, where the failure actually surfaces.
 */

/** Mark that recovery was already attempted in this browser session. */
export const RECOVERY_TEST_KEY = "lumiere.staleDeploy.recovered";
const RECOVERY_KEY = RECOVERY_TEST_KEY;

/**
 * Known chunk-load failure signatures. Every pattern here means "the deployed
 * JS graph is not what this tab is running" — and nothing else. Order matters
 * only for which signature name gets logged first.
 *
 * - Chrome/Edge: "Failed to fetch dynamically imported module: …"
 * - Safari:      "Importing a module script failed:"
 * - Firefox:     "error loading dynamically imported module"
 * - ChunkLoadError is webpack vocabulary; kept defensively for wrappers.
 * - MIME mismatch happens when a cached HTML shell references an asset whose
 *   path now serves an HTML 404 page instead of JS.
 */
const CHUNK_FAILURE_SIGNATURES: ReadonlyArray<{ name: string; test: RegExp }> = [
  { name: "dynamic_import_fetch_failed", test: /failed to fetch dynamically imported module/i },
  { name: "module_script_import_failed", test: /importing a module script failed/i },
  { name: "dynamic_import_generic", test: /error loading dynamically imported module/i },
  { name: "chunk_load_error", test: /\bchunkloaderror\b/i },
  { name: "css_chunk_import_failed", test: /failed to fetch .*\.css/i },
  { name: "mime_type_mismatch", test: /disallowed MIME type|expected a JavaScript module script/i },
];

/** Match an error (or string) against the known chunk-failure signatures. */
export function matchChunkFailure(error: unknown): string | null {
  if (error == null) return null;
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : String(error);
  for (const { name, test } of CHUNK_FAILURE_SIGNATURES) {
    if (test.test(message)) return name;
  }
  return null;
}

/** Like matchChunkFailure, but also walks `error.cause` (ES2022 Error Cause). */
export function matchChunkFailureDeep(error: unknown, depth = 0): string | null {
  if (depth > 4 || error == null) return null;
  const direct = matchChunkFailure(error);
  if (direct) return direct;
  const cause = (error as { cause?: unknown } | null)?.cause;
  return cause ? matchChunkFailureDeep(cause, depth + 1) : null;
}

function logStaleDeploy(
  action: "recovering" | "reload" | "blocked" | "none",
  payload: Record<string, unknown>,
): void {
  const record = { action, ...payload, timestamp: new Date().toISOString() };
  const line = `[stale-deploy] ${JSON.stringify(record)}`;
  // Recovery is expected behaviour — warn. Everything else is worth surfacing.
  if (action === "reload" || action === "recovering") console.warn(line);
  else console.error(line);
}

let recoveryAttemptedMemory = false;

/** True once per browser session, false afterwards — the loop guard. */
function claimRecovery(): boolean {
  try {
    const s = window.sessionStorage;
    if (s.getItem(RECOVERY_KEY)) return false;
    s.setItem(RECOVERY_KEY, "1");
    return true;
  } catch {
    // Storage unavailable (private mode, blocked cookies). Fall back to an
    // in-memory flag: still exactly one attempt per page load, and the
    // reload itself resets it — same loop guarantee, shorter memory.
    if (recoveryAttemptedMemory) return false;
    recoveryAttemptedMemory = true;
    return true;
  }
}

/**
 * Decide and act on a chunk-load failure at the error-boundary level.
 *
 * Returns true when a cache-bypassing reload has been initiated (the caller
 * should render nothing else — the page is going away). Returns false when the
 * error was not a chunk failure, or when recovery was already attempted this
 * session: in both cases the caller must render its normal error boundary.
 */
export function recoverFromStaleDeploy(error: unknown): boolean {
  const signature = matchChunkFailureDeep(error);

  // Not a deployment artifact problem — a genuine application failure. Log it
  // as such so platform logs separate the two populations.
  if (!signature) {
    logStaleDeploy("none", {
      exceptionType: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    });
    return false;
  }

  if (!claimRecovery()) {
    // Already tried once this session. Rendering the boundary and stopping is
    // correct: repeated reloading while the deployment is broken helps nobody.
    logStaleDeploy("blocked", {
      signature,
      reason: "recovery already attempted this session",
    });
    return false;
  }

  // Cache-bypassing: a fresh query string defeats the HTML cache and forces
  // revalidation of index.html, landing the tab on the current deployment.
  const url = new URL(window.location.href);
  url.searchParams.set("staleDeployReload", Date.now().toString(36));
  logStaleDeploy("recovering", {
    signature,
    reason: "chunk-load failure matches a stale-deploy signature",
  });
  logStaleDeploy("reload", { signature, path: url.pathname });
  window.location.replace(url.toString());
  return true;
}

/** Test-only reset of the in-memory fallback flag. */
export function resetStaleDeployStateForTests(): void {
  recoveryAttemptedMemory = false;
}

/** Expose the matcher on window for manual debugging in production. */
export function installStaleDeployRecovery(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { __staleDeploy?: object }).__staleDeploy = {
    match: matchChunkFailureDeep,
    recover: recoverFromStaleDeploy,
    RECOVERY_KEY,
  };
}
