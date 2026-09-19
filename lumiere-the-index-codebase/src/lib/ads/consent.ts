/**
 * The Index — Ad Consent & Script Loading Architecture
 * ════════════════════════════════════════════════════
 *
 * Load order (enforced by loadAdSenseScript):
 *
 *   ADS_ENABLED === false            → never load anything (the site behaves
 *                                      as though advertising does not exist)
 *   ADSENSE_CLIENT missing           → nothing to load
 *   consent state !== "granted"      → wait; no script may run before consent
 *   all three pass                   → inject the AdSense library exactly once
 *
 * Consent state resolution, in priority order:
 *   1. A Consent Management Platform (CMP) integrating with the IAB TCF v2.2
 *      `__tcfapi` global — Google's recommended path.
 *   2. Google Consent Mode v2 signals on the dataLayer (ad_storage /
 *      analytics_storage), for sites using Consent Mode without a CMP.
 *   3. A simple local storage flag (`index.ads.consent` = "granted"), so a
 *      future first-party consent banner can integrate with zero changes here.
 *   4. No consent signal at all → "unknown" → scripts stay blocked.
 *
 * NO FAKE CONSENT is implemented. Nothing auto-grants. Where consent is
 * legally required, no advertising script runs until a real consent
 * mechanism grants it. Personalized-ads decisions can later plug into the
 * same gate (e.g. request non-personalized ads when consent is limited).
 */

export type ConsentState = "unknown" | "granted" | "denied";

const LOCAL_CONSENT_KEY = "index.ads.consent";

/** Narrow, typed shape of the TCF API we rely on — avoids `any`. */
interface TcfApiGlobal {
  (__command: "getTCData", ...rest: unknown[]): void;
}

declare global {
  interface Window {
    __tcfapi?: TcfApiGlobal;
    dataLayer?: unknown[];
  }
}

function readLocalConsent(): ConsentState {
  try {
    const v = window.localStorage.getItem(LOCAL_CONSENT_KEY);
    return v === "granted" ? "granted" : v === "denied" ? "denied" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Resolve the current consent state from whatever mechanism is installed.
 *  Safe to call during SSR — returns "unknown" outside the browser. */
export function getConsentState(): ConsentState {
  if (typeof window === "undefined") return "unknown";

  // 1. IAB TCF v2.2 CMP (synchronous surface only — full TCF integration
  //    will subscribe via addEventListener when a CMP is actually chosen).
  if (typeof window.__tcfapi === "function") {
    let resolved: ConsentState | null = null;
    try {
      window.__tcfapi("getTCData", 2, (tcData: unknown) => {
        const data = tcData as { gdprApplies?: boolean; purpose?: { consents?: Record<number, boolean> } } | undefined;
        if (!data) {
          resolved = "unknown";
        } else if (data.gdprApplies === false) {
          resolved = "granted"; // GDPR not applicable to this visitor
        } else {
          // Purpose 1 = "Store and/or access information on a device"
          resolved = data.purpose?.consents?.[1] ? "granted" : "denied";
        }
      });
    } catch {
      resolved = null;
    }
    if (resolved) return resolved;
  }

  // 2. Google Consent Mode v2 on the dataLayer.
  const dl = window.dataLayer;
  if (Array.isArray(dl)) {
    for (let i = dl.length - 1; i >= 0; i--) {
      const entry = dl[i] as { event?: string; ad_storage?: string } | null;
      if (entry && entry.event === "gtm consent update" && typeof entry.ad_storage === "string") {
        return entry.ad_storage === "granted" ? "granted" : "denied";
      }
    }
  }

  // 3. First-party flag (future consent banner writes here).
  return readLocalConsent();
}

/** Allow a future consent UI to record a decision explicitly. */
export function setLocalConsent(state: Exclude<ConsentState, "unknown">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_CONSENT_KEY, state);
  } catch {
    // Storage unavailable (private mode) — consent simply stays "unknown"
    // and advertising scripts remain blocked, which is the safe default.
  }
}
