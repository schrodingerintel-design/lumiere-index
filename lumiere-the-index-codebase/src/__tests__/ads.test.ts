import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Advertising infrastructure tests (node environment — no DOM).
 *
 * The critical invariants:
 *  1. With ADS_ENABLED=false (the shipped default) nothing may load: the
 *     gate refuses and no network call is even attempted.
 *  2. No advertising script can load before consent is granted.
 *  3. Auto Ads are off by default.
 *  4. Placements are stable, unique, lazy, and search has none.
 */
import { ADSENSE_LIB_URL } from "@/lib/ads/adsense";
import {
  AUTO_ADS_ENABLED,
  CONSENT_REQUIRED,
  PLACEMENTS,
  getPlacement,
} from "@/lib/ads/config";
import { getConsentState, setLocalConsent } from "@/lib/ads/consent";

// Minimal DOM surface so consent.ts/adsense.ts guards behave without jsdom.
// Everything the modules touch at test time goes through these stubs.
const store = new Map<string, string>();

/** Shape of the <script> the loader is expected to create. */
interface FakeScript {
  src: string;
  async: boolean;
  crossOrigin: string;
}
const appendedScripts: FakeScript[] = [];

vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  __tcfapi: undefined,
  dataLayer: undefined,
});
vi.stubGlobal("document", {
  querySelector: vi.fn(() => null),
  createElement: vi.fn(() => ({ src: "", async: false, crossOrigin: "" })),
  head: {
    appendChild: vi.fn((el: FakeScript) => {
      appendedScripts.push(el);
    }),
  },
});

describe("ad global configuration", () => {
  it("has Auto Ads OFF by default", () => {
    expect(AUTO_ADS_ENABLED).toBe(false);
  });

  it("requires consent before any ad script may load", () => {
    expect(CONSENT_REQUIRED).toBe(true);
  });
});

/**
 * These guarantees are about the CODE, not about whatever the deployment
 * environment happens to set, so every case pins the flags explicitly. The
 * site is now configured with ads ON, and an ambient .env must not be able to
 * make these assertions silently untrue.
 */
describe("ads fully off — the disabled guarantee", () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
    vi.stubEnv("VITE_ADS_ENABLED", "false");
    vi.stubEnv("VITE_ADSENSE_CLIENT", "");
  });

  it("keeps advertising off and Auto Ads off", async () => {
    const cfg = await import("@/lib/ads/config");
    expect(cfg.ADS_ENABLED).toBe(false);
    expect(cfg.AUTO_ADS_ENABLED).toBe(false);
  });

  it("never requests any script while ads are disabled", async () => {
    const { loadAdSenseScript, adSenseRequested, adSenseLoadStatus } =
      await import("@/lib/ads/adsense");
    loadAdSenseScript();
    expect(adSenseRequested()).toBe(false);
    const status = adSenseLoadStatus();
    expect(status.allowed).toBe(false);
    expect(status.blockedBy).toBe("ADS_ENABLED=false");
  });

  it("never reaches a load-allowed state in the shipped configuration", async () => {
    // Ads disabled → blocked regardless of consent.
    const { setLocalConsent: set } = await import("@/lib/ads/consent");
    const { loadAdSenseScript, adSenseLoadStatus } = await import(
      "@/lib/ads/adsense"
    );
    set("granted");
    loadAdSenseScript();
    expect(adSenseLoadStatus().blockedBy).toBe("ADS_ENABLED=false");
    expect(document.querySelector).not.toHaveBeenCalledWith(
      expect.stringContaining("adsbygoogle"),
    );
  });
});

describe("adSense script gating", () => {
  beforeEach(() => {
    vi.resetModules();
    store.clear();
  });

  it("reports consent as unknown with no mechanism installed", () => {
    expect(getConsentState()).toBe("unknown");
  });

  it("stores and reads an explicit local consent decision", () => {
    setLocalConsent("granted");
    expect(getConsentState()).toBe("granted");
    setLocalConsent("denied");
    expect(getConsentState()).toBe("denied");
  });

  it("points the loader at Google's official library host", () => {
    expect(ADSENSE_LIB_URL).toBe(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
    );
  });
});

/**
 * The verification meta tag, the loader's client id, and the ads.txt
 * declaration must all name the same publisher. AdSense rejects a site whose
 * three declarations disagree, and the meta tag in particular is UNCONDITIONAL
 * in the head — it is no longer derived from the ad-serving env var, because a
 * build without those vars shipped no tag at all and verification failed.
 */
describe("publisher id consistency", () => {
  it("declares a publisher account id", async () => {
    const { ADSENSE_ACCOUNT_ID } = await import("@/lib/ads/config");
    expect(ADSENSE_ACCOUNT_ID).toMatch(/^ca-pub-\d+$/);
  });

  it("ships the same publisher id in ads.txt", async () => {
    const { readFileSync } = await import("node:fs");
    const { ADSENSE_ACCOUNT_ID } = await import("@/lib/ads/config");
    const adsTxt = readFileSync(
      new URL("../../public/ads.txt", import.meta.url),
      "utf8",
    );
    expect(adsTxt).toContain(ADSENSE_ACCOUNT_ID);
  });

  it("uses the account id for the loader when the env var is set", async () => {
    store.clear();
    // Read the constant, then reset so config.ts is re-evaluated AFTER both
    // variables are stubbed — otherwise it captures whatever ambient value the
    // developer's or CI's environment happens to hold.
    const { ADSENSE_ACCOUNT_ID } = await import("@/lib/ads/config");
    vi.resetModules();
    vi.stubEnv("VITE_ADS_ENABLED", "true");
    vi.stubEnv("VITE_ADSENSE_CLIENT", ADSENSE_ACCOUNT_ID);
    const { setLocalConsent: set } = await import("@/lib/ads/consent");
    const { loadAdSenseScript, adSenseRequested } = await import(
      "@/lib/ads/adsense"
    );
    set("granted");
    loadAdSenseScript();
    expect(adSenseRequested()).toBe(true);
    expect(appendedScripts.at(-1)?.src).toContain(ADSENSE_ACCOUNT_ID);
  });
});

describe("placement registry", () => {
  it("contains every planned placement id", () => {
    const ids = Object.keys(PLACEMENTS);
    expect(ids).toEqual(
      expect.arrayContaining([
        "home-after-top10",
        "home-secondary",
        "top100-after-20",
        "top100-after-50",
        "tv100-after-10",
        "tv100-after-30",
        "genre-inline",
        "title-secondary",
      ]),
    );
  });

  it("gives every placement a unique id matching its key", () => {
    for (const [key, p] of Object.entries(PLACEMENTS)) {
      expect(p.id).toBe(key);
      expect(p.where.length).toBeGreaterThan(0);
    }
  });

  it("has NO search placement by product decision", () => {
    const ids = Object.keys(PLACEMENTS);
    expect(ids.some((id) => id.toLowerCase().includes("search"))).toBe(false);
  });

  it("marks every placement lazy — no ad request before scroll proximity", () => {
    for (const p of Object.values(PLACEMENTS)) {
      expect(p.lazy).toBe(true);
    }
  });

  it("resolves placements by id", () => {
    expect(getPlacement("top100-after-20")?.id).toBe("top100-after-20");
    expect(getPlacement("nonexistent")).toBeUndefined();
  });
});

/**
 * Consent must be OBSERVABLE, not just readable. A slot that rendered while
 * the visitor had not yet decided would otherwise stay blocked for the whole
 * session, so every decision has to notify subscribers.
 */
describe("consent reactivity", () => {
  beforeEach(() => {
    store.clear();
  });

  it("notifies subscribers when consent is granted", async () => {
    vi.resetModules();
    const { subscribeConsent, setLocalConsent: set } = await import(
      "@/lib/ads/consent"
    );
    const seen = vi.fn();
    const unsubscribe = subscribeConsent(seen);
    set("granted");
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("notifies subscribers when consent is denied", async () => {
    vi.resetModules();
    const { subscribeConsent, setLocalConsent: set } = await import(
      "@/lib/ads/consent"
    );
    const seen = vi.fn();
    const unsubscribe = subscribeConsent(seen);
    set("denied");
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("stops notifying after unsubscribe", async () => {
    vi.resetModules();
    const { subscribeConsent, setLocalConsent: set } = await import(
      "@/lib/ads/consent"
    );
    const seen = vi.fn();
    subscribeConsent(seen)();
    set("granted");
    expect(seen).not.toHaveBeenCalled();
  });

  it("clears a recorded decision back to unknown and notifies", async () => {
    vi.resetModules();
    const { subscribeConsent, setLocalConsent: set, clearLocalConsent, getConsentState: get } =
      await import("@/lib/ads/consent");
    const seen = vi.fn();
    const unsubscribe = subscribeConsent(seen);
    set("granted");
    expect(get()).toBe("granted");
    seen.mockClear();
    clearLocalConsent();
    expect(get()).toBe("unknown");
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

/**
 * With advertising switched on, the gate must open for a visitor who consents
 * and stay shut for one who declines — the whole point of the architecture.
 */
describe("gate with advertising enabled", () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
    vi.stubEnv("VITE_ADS_ENABLED", "true");
    vi.stubEnv("VITE_ADSENSE_CLIENT", "ca-pub-4820978382535849");
  });

  it("blocks until consent is granted", async () => {
    const { adSenseLoadStatus } = await import("@/lib/ads/adsense");
    expect(adSenseLoadStatus().allowed).toBe(false);
    expect(adSenseLoadStatus().blockedBy).toMatch(/consent=unknown/);
  });

  it("opens once consent is granted", async () => {
    const { setLocalConsent: set } = await import("@/lib/ads/consent");
    const { adSenseLoadStatus } = await import("@/lib/ads/adsense");
    set("granted");
    expect(adSenseLoadStatus().allowed).toBe(true);
  });

  it("stays blocked after consent is declined", async () => {
    const { setLocalConsent: set } = await import("@/lib/ads/consent");
    const { adSenseLoadStatus } = await import("@/lib/ads/adsense");
    set("denied");
    expect(adSenseLoadStatus().allowed).toBe(false);
    expect(adSenseLoadStatus().blockedBy).toMatch(/consent=denied/);
  });

  it("still blocks with consent granted when no publisher id is configured", async () => {
    vi.stubEnv("VITE_ADSENSE_CLIENT", "");
    const { setLocalConsent: set } = await import("@/lib/ads/consent");
    const { adSenseLoadStatus } = await import("@/lib/ads/adsense");
    set("granted");
    expect(adSenseLoadStatus().allowed).toBe(false);
    expect(adSenseLoadStatus().blockedBy).toBe("ADSENSE_CLIENT missing");
  });

  it("injects Google's official tag, async and cross-origin, with the publisher id", async () => {
    appendedScripts.length = 0;
    const { setLocalConsent: set } = await import("@/lib/ads/consent");
    const { loadAdSenseScript, adSenseRequested } = await import(
      "@/lib/ads/adsense"
    );
    set("granted");
    loadAdSenseScript();
    expect(adSenseRequested()).toBe(true);

    const tag = appendedScripts.at(-1);
    expect(tag).toBeDefined();
    // Exactly the snippet Google asks publishers to serve.
    expect(tag!.src).toBe(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4820978382535849",
    );
    expect(tag!.async).toBe(true);
    expect(tag!.crossOrigin).toBe("anonymous");
  });

  it("still injects nothing when consent is denied, even with ads on", async () => {
    appendedScripts.length = 0;
    const { setLocalConsent: set } = await import("@/lib/ads/consent");
    const { loadAdSenseScript, adSenseRequested } = await import(
      "@/lib/ads/adsense"
    );
    set("denied");
    loadAdSenseScript();
    expect(adSenseRequested()).toBe(false);
    expect(appendedScripts).toHaveLength(0);
  });

  it("injects nothing at all when consent is denied", async () => {
    appendedScripts.length = 0;
    const { setLocalConsent: set } = await import("@/lib/ads/consent");
    const { loadAdSenseScript, adSenseRequested } = await import(
      "@/lib/ads/adsense"
    );
    set("denied");
    loadAdSenseScript();
    expect(adSenseRequested()).toBe(false);
    expect(appendedScripts).toHaveLength(0);
  });
});
