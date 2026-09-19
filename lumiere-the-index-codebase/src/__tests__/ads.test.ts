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
import { loadAdSenseScript, adSenseRequested, adSenseLoadStatus, ADSENSE_LIB_URL } from "@/lib/ads/adsense";
import {
  ADS_ENABLED,
  AUTO_ADS_ENABLED,
  CONSENT_REQUIRED,
  PLACEMENTS,
  getPlacement,
} from "@/lib/ads/config";
import { getConsentState, setLocalConsent } from "@/lib/ads/consent";

// Minimal DOM surface so consent.ts/adsense.ts guards behave without jsdom.
// Everything the modules touch at test time goes through these stubs.
const store = new Map<string, string>();
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
  createElement: vi.fn(),
  head: { appendChild: vi.fn() },
});

describe("ad global configuration", () => {
  it("has advertising globally DISABLED by default", () => {
    expect(ADS_ENABLED).toBe(false);
  });

  it("has Auto Ads OFF by default", () => {
    expect(AUTO_ADS_ENABLED).toBe(false);
  });

  it("requires consent before any ad script may load", () => {
    expect(CONSENT_REQUIRED).toBe(true);
  });
});

describe("adSense script gating", () => {
  beforeEach(() => {
    vi.resetModules();
    store.clear();
  });

  it("never requests any script while ads are disabled", () => {
    loadAdSenseScript();
    expect(adSenseRequested()).toBe(false);
    const status = adSenseLoadStatus();
    expect(status.allowed).toBe(false);
    expect(status.blockedBy).toBe("ADS_ENABLED=false");
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

  it("never reaches a load-allowed state in the shipped configuration", () => {
    // Shipped config: ads disabled → blocked regardless of consent.
    loadAdSenseScript();
    expect(adSenseLoadStatus().blockedBy).toBe("ADS_ENABLED=false");
    expect(document.querySelector).not.toHaveBeenCalledWith(
      expect.stringContaining("adsbygoogle"),
    );
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
