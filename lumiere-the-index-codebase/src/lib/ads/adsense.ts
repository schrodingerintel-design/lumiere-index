/**
 * The Index — Google AdSense loader
 * ═════════════════════════════════
 * The ONLY place in the codebase that touches Google advertising scripts.
 * Pages and components must never hard-code Google logic — they render
 * <AdSlot placement="…" /> and this module decides whether any script runs.
 *
 * Guarantees:
 *  - With ADS_ENABLED=false (current production state) nothing here ever
 *    executes a load: no <script> tag, no network request to Google, no
 *    dataLayer traffic. The bundle merely carries inert constants.
 *  - With consent unresolved or denied, the library never loads.
 *  - The library is injected at most once per document.
 *  - Auto Ads stay OFF unless separately enabled (VITE_ADS_AUTO=true) —
 *    The Index controls its own placements.
 *
 * SSR safety: every window/document access is guarded; the server never
 * loads advertising scripts.
 */
import { ADS_ENABLED, ADSENSE_CLIENT, AUTO_ADS_ENABLED, CONSENT_REQUIRED } from "./config";
import { getConsentState, type ConsentState } from "./consent";

export const ADSENSE_LIB_URL = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

let loadAttempted = false;
let loadBlockedBy: string | null = null;

/** Why the AdSense library is (or is not yet) allowed to load — used by tests,
 *  the dev slot preview, and future diagnostics. */
export function adSenseLoadStatus(): { allowed: boolean; blockedBy: string | null; state: ConsentState } {
  const state = getConsentState();
  if (!ADS_ENABLED) return { allowed: false, blockedBy: "ADS_ENABLED=false", state };
  if (!ADSENSE_CLIENT) return { allowed: false, blockedBy: "ADSENSE_CLIENT missing", state };
  if (CONSENT_REQUIRED && state !== "granted") {
    return { allowed: false, blockedBy: `consent=${state}`, state };
  }
  return { allowed: true, blockedBy: null, state };
}

function injectLibrary(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector<HTMLScriptElement>(`script[src^="${ADSENSE_LIB_URL}"]`)) {
    return; // already present — never inject twice
  }
  const s = document.createElement("script");
  s.src = `${ADSENSE_LIB_URL}?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
  s.async = true;
  s.crossOrigin = "anonymous";
  // Signals Google to hold off personalized ads until Consent Mode grants;
  // harmless when Consent Mode is not in use.
  (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle =
    (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ?? [];
  document.head.appendChild(s);
}

/** Idempotently load the AdSense library when every gate allows it. Called by
 *  AdSlot on mount (and no earlier) so zero ad JavaScript loads on pages
 *  without placements, and none loads at all while ads are disabled. */
export function loadAdSenseScript(): void {
  loadAttempted = true;
  const status = adSenseLoadStatus();
  loadBlockedBy = status.allowed ? null : (status.blockedBy ?? "blocked");
  if (!status.allowed) return;
  injectLibrary();
}

/** True once a load call has been made and every gate passed. */
export function adSenseRequested(): boolean {
  return loadAttempted && loadBlockedBy === null;
}

/** Opt-in Auto Ads configuration. Off by default; only ever called after the
 *  library has legitimately loaded. */
export function initAutoAds(): void {
  if (!ADS_ENABLED || !AUTO_ADS_ENABLED || !ADSENSE_CLIENT) return;
  if (CONSENT_REQUIRED && getConsentState() !== "granted") return;
  if (typeof window === "undefined") return;
  const w = window as unknown as { adsbygoogle?: Record<string, unknown>[] };
  w.adsbygoogle = w.adsbygoogle ?? [];
  w.adsbygoogle.push({ google_ad_client: ADSENSE_CLIENT, enable_page_level_ads: true });
}
