/**
 * The Index — Central Advertising Configuration
 * ═════════════════════════════════════════════
 *
 * RANKING INDEPENDENCE (architectural guarantee)
 * ──────────────────────────────────────────────
 * Advertising is a PRESENTATION-LAYER concern and has absolutely no connection
 * to the ranking engine. Advertisers cannot influence:
 *
 *   - Index Score / TVDex Score
 *   - chart position or rank numbering
 *   - movement indicators
 *   - Movie 100 / TV 100 eligibility
 *   - Biggest Movers, New Entries, Weekly Index, All-Time records
 *
 * The scores and ranks rendered next to an ad slot come exclusively from the
 * backend ranking pipeline (backend/app/services/ranking.py), which is fed by
 * measured cultural signals only. No ad module imports ranking code, no
 * ranking module imports ad code, and no ad data ever enters the scoring
 * pipeline. An advertisement must never be visually confused with a ranked
 * title — see AdSlot.tsx for the visual contract.
 *
 * CURRENT STATE
 * ─────────────
 * Advertising is NOT active. With ADS_ENABLED=false (the default):
 *   - no Google scripts load (client or server)
 *   - no ad requests occur
 *   - no containers, space, or placeholders appear
 * The production site behaves exactly as though advertising does not exist.
 */

/** Build-time flags via Vite env vars (set in the host environment, not committed):
 *  - VITE_ADS_ENABLED       master switch — "true" activates the ad system
 *  - VITE_ADSENSE_CLIENT    Google AdSense publisher id, e.g. "ca-pub-XXXXXXXX"
 *  - VITE_ADS_AUTO          "true" enables Google Auto Ads (STAYS OFF by default)
 *  - VITE_ADS_CONSENT_REQUIRED  "false" only where consent is not legally required
 *  - VITE_SHOW_AD_SLOTS     developer slot preview (dev builds only, never prod)
 */
const env = import.meta.env as Record<string, string | undefined>;

export const ADS_ENABLED = env.VITE_ADS_ENABLED === "true";

/** Google AdSense publisher account. Empty until monetization is approved. */
export const ADSENSE_CLIENT = env.VITE_ADSENSE_CLIENT ?? "";

/** Google Auto Ads — deliberately OFF. The Index controls its own placements
 *  so ads can never appear inside navigation, the hero, or between critical
 *  ranking information. Keep separately configurable and off by default. */
export const AUTO_ADS_ENABLED = env.VITE_ADS_AUTO === "true";

/** Consent gate. When true (the default), no advertising script may load until
 *  a consent mechanism has granted permission. The consent layer itself is
 *  intentionally NOT implemented yet — see adsense.ts. */
export const CONSENT_REQUIRED = env.VITE_ADS_CONSENT_REQUIRED !== "false";

/** Developer slot preview. Only ever honoured in dev builds; production builds
 *  hard-ignore this flag so preview boxes can never ship. */
export const SHOW_AD_SLOTS_DEV = env.VITE_SHOW_AD_SLOTS === "true";

// ─── Placement registry ───────────────────────────────────────────────────────

/** Responsive ad format per breakpoint. Sizes follow AdSense display units;
 *  mobile units are designed independently (never a shrunken desktop unit). */
export interface AdFormat {
  /** AdSense data-ad-format value ("auto", "horizontal", …). */
  format: "auto" | "horizontal" | "rectangle" | "vertical";
  /** CSS min-height classes reserved ONLY while an ad is actually enabled and
   *  loading — prevents layout shift without creating blank voids. */
  reserveMobile: string;
  reserveDesktop: string;
}

export interface AdPlacement {
  /** Stable public id — also the per-placement analytics key (§ Future analytics). */
  id: string;
  /** Human-readable location description for the registry. */
  where: string;
  /** Individual kill-switch: a placement can be disabled without touching pages. */
  enabled: boolean;
  /** Load the ad only when the slot approaches the viewport. */
  lazy: boolean;
  desktop: AdFormat;
  mobile: AdFormat;
}

const mobileFluid: AdFormat = {
  format: "auto",
  reserveMobile: "min-h-[100px]",
  reserveDesktop: "min-h-[100px]",
};

const desktopWide: AdFormat = {
  format: "horizontal",
  reserveMobile: "min-h-[100px]",
  reserveDesktop: "min-h-[120px]",
};

/**
 * Every future advertisement location, declared once. Pages reference slots
 * ONLY by placement id — never hard-code Google logic in a page.
 *
 * Frequency is deliberately low: discovery pages get at most one inline slot,
 * charts get two, and search gets none by product decision.
 */
export const PLACEMENTS: Record<string, AdPlacement> = {
  /** Homepage — after the Top 10 / primary ranking experience. Never inside
   *  the hero, under the #1 title, inside Top 10, or inside navigation. */
  "home-after-top10": {
    id: "home-after-top10",
    where: "Home · after Movie 100 Top 10, before TV 100 Top 5",
    enabled: true,
    lazy: true,
    desktop: desktopWide,
    mobile: mobileFluid,
  },
  /** Homepage — far down the page between secondary discovery sections. */
  "home-secondary": {
    id: "home-secondary",
    where: "Home · between PulseRow and genre exploration",
    enabled: true,
    lazy: true,
    desktop: desktopWide,
    mobile: mobileFluid,
  },
  /** Movie 100 — after ~rank #20. The ad is a non-ranked list row: it never
   *  receives a rank number and never resembles a ranked title. */
  "top100-after-20": {
    id: "top100-after-20",
    where: "Movie 100 · after rank #20",
    enabled: true,
    lazy: true,
    desktop: desktopWide,
    mobile: mobileFluid,
  },
  /** Movie 100 — around ranks #50–60. */
  "top100-after-50": {
    id: "top100-after-50",
    where: "Movie 100 · after rank #50",
    enabled: true,
    lazy: true,
    desktop: desktopWide,
    mobile: mobileFluid,
  },
  /** TV 100 — after ~#10. Outside the ranking system entirely. */
  "tv100-after-10": {
    id: "tv100-after-10",
    where: "TV 100 · after rank #10",
    enabled: true,
    lazy: true,
    desktop: desktopWide,
    mobile: mobileFluid,
  },
  /** TV 100 — around #30. */
  "tv100-after-30": {
    id: "tv100-after-30",
    where: "TV 100 · after rank #30",
    enabled: true,
    lazy: true,
    desktop: desktopWide,
    mobile: mobileFluid,
  },
  /** Genre / discovery pages — a single inline slot between logical content
   *  groups. Never after every few titles. */
  "genre-inline": {
    id: "genre-inline",
    where: "Genre shelf · between content groups",
    enabled: true,
    lazy: true,
    desktop: desktopWide,
    mobile: mobileFluid,
  },
  /** Title pages — one slot after ALL primary title information (header,
   *  score, rank, history, sentiment, trailer, facts). Never over the
   *  backdrop, beside the title/score, between rank and score, over posters,
   *  inside trailers, or inside the primary header. */
  "title-secondary": {
    id: "title-secondary",
    where: "Title page · after primary info, before More Like This",
    enabled: true,
    lazy: true,
    desktop: desktopWide,
    mobile: mobileFluid,
  },
  /** SEARCH: intentionally NO placement. Search stays focused on finding
   *  titles. The registry pattern supports a future id without code changes. */
} as const;

export type PlacementId = keyof typeof PLACEMENTS;

export function getPlacement(id: string): AdPlacement | undefined {
  return PLACEMENTS[id];
}
