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
 *   3. GUARD — loop prevention scoped to the FAILED DEPLOYMENT plus a short
 *      recovery window, not the whole session. A second failure for the same
 *      chunk within the window renders the error boundary (no loop); a LATER
 *      deployment failing with a different chunk hash is a new situation and
 *      recovers independently. Two limits hold the line: at most 3 recovery
 *      attempts, and a 5-minute cooldown after the last one.
 *
 * Logging is structured so platform logs can distinguish the two:
 *
 *   [stale-deploy] {"action":"recovering", ...} → matched, reloading now
 *   [stale-deploy] {"action":"reload",     ...} → reload issued
 *   [stale-deploy] {"action":"blocked",    ...} → within cooldown/attempt cap
 *   [stale-deploy] {"action":"none",       ...} → not a chunk failure
 *
 * The previous implementation listened on `unhandledrejection`, but the router
 * catches chunk-load rejections internally and renders its error boundary, so
 * that event never fired and the safety net was inoperative. Detection now
 * happens at the error-boundary level, where the failure actually surfaces.
 */

/**
 * Loop prevention, scoped to the failed deployment rather than the session.
 *
 * Why not "once per session": deployments keep landing. A visitor hit by a
 * stale chunk at 10:00 and by a different one at 15:00 has two independent
 * problems; blocking the second recovery turns a fixable reload into a
 * permanent dead tab. So the guard is a short-window, per-failure-state
 * budget:
 *
 *   - `signature` of the failing chunk (the failure's identity)
 *   - `attempts`   max recovery attempts inside the window (hard cap 3)
 *   - `firstAt`    window start; resets only after a quiet period
 *   - `lastAt`     last attempt time (drives the cooldown)
 *
 * If the SAME signature fails again inside the window after the cap, the
 * boundary renders and recovery is genuinely abandoned for that deployment —
 * a reload loop would otherwise fight a broken deploy for an hour. A new
 * signature means a new deployment artifact set, so it gets a fresh budget.
 */
const RECOVERY_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 3;

interface RecoveryState {
  attempts: number;
  firstAt: number;
  lastAt: number;
}

const RECOVERY_STATE_KEY = "lumiere.staleDeploy.state";
export const RECOVERY_TEST_KEY = RECOVERY_STATE_KEY;

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

/**
 * Match an error against the known chunk-failure signatures.
 *
 * When the error message names the failing asset (it usually does — Vite and
 * every major browser include the URL), the signature is refined with that
 * asset path so the loop-prevention budget is keyed to the SPECIFIC failed
 * deployment artifact, not just "some chunk failed". That is what lets a
 * later deployment — different chunk hash, different message — recover
 * independently while the budget for the earlier one is still exhausted.
 */
export function matchChunkFailure(error: unknown): string | null {
  if (error == null) return null;
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : String(error);
  for (const { name, test } of CHUNK_FAILURE_SIGNATURES) {
    if (!test.test(message)) continue;
    // Refine with the failing asset path when present: /assets/index-abc.js
    const asset = message.match(/\/assets\/[^'"\s:)]+/i);
    return asset ? `${name}#${asset[0]}` : name;
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

let recoveryStateMemory: Record<string, RecoveryState> = {};

function nowMs(): number {
  return Date.now();
}

/** Read the persisted recovery state for one failure signature. */
function readRecoveryState(signature: string): RecoveryState | null {
  // In-memory mirror first: identical answer, but also correct when storage
  // is unavailable (private mode) — then it lives exactly as long as the page.
  const mirrored = recoveryStateMemory[signature];
  if (mirrored) return mirrored;
  try {
    const raw = window.sessionStorage.getItem(RECOVERY_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, RecoveryState>;
    return parsed[signature] ?? null;
  } catch {
    return null;
  }
}

function writeRecoveryState(signature: string, state: RecoveryState | null): void {
  if (state === null) delete recoveryStateMemory[signature];
  else recoveryStateMemory[signature] = state;
  try {
    if (Object.keys(recoveryStateMemory).length === 0 && state === null) {
      window.sessionStorage.removeItem(RECOVERY_STATE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      RECOVERY_STATE_KEY,
      JSON.stringify(recoveryStateMemory),
    );
  } catch {
    // Storage unavailable — the in-memory mirror above still prevents loops
    // for this page load; the reload itself clears it.
  }
}

/**
 * True when a recovery attempt is allowed for this signature. Consumes one
 * attempt from the budget when it returns true.
 */
function claimRecovery(signature: string): boolean {
  const now = nowMs();
  const windowMs = RECOVERY_WINDOW_MS_OVERRIDE ?? RECOVERY_WINDOW_MS;
  const prev = readRecoveryState(signature);

  // No recent failure of this kind: fresh budget.
  if (!prev) {
    writeRecoveryState(signature, { attempts: 1, firstAt: now, lastAt: now });
    return true;
  }

  // The window has expired — this is a NEW failure episode (e.g. a later
  // deployment), so the budget resets and recovery may run again.
  if (now - prev.lastAt > windowMs) {
    writeRecoveryState(signature, { attempts: 1, firstAt: now, lastAt: now });
    return true;
  }

  // Still inside the window: allowed only while under the attempt cap.
  if (prev.attempts < MAX_ATTEMPTS_PER_WINDOW) {
    writeRecoveryState(signature, {
      ...prev,
      attempts: prev.attempts + 1,
      lastAt: now,
    });
    return true;
  }

  // Cap exhausted inside the window — render the boundary, stop reloading.
  return false;
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

  if (!claimRecovery(signature)) {
    // Attempt cap reached inside the recovery window. Rendering the boundary
    // and stopping is correct: repeated reloading while the deployment is
    // broken helps nobody. A later deployment (new chunk hash → new
    // signature) gets a fresh budget and can still recover.
    logStaleDeploy("blocked", {
      signature,
      reason: "recovery attempts exhausted within the window",
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

/** Test-only reset of the in-memory recovery state. */
export function resetStaleDeployStateForTests(): void {
  recoveryStateMemory = {};
}

/** Test-only: override the recovery window length. */
export function setRecoveryWindowForTests(ms: number): void {
  RECOVERY_WINDOW_MS_OVERRIDE = ms;
}

let RECOVERY_WINDOW_MS_OVERRIDE: number | null = null;

/** Expose the matcher on window for manual debugging in production. */
export function installStaleDeployRecovery(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { __staleDeploy?: object }).__staleDeploy = {
    match: matchChunkFailureDeep,
    recover: recoverFromStaleDeploy,
    RECOVERY_STATE_KEY,
  };
}
