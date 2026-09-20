/**
 * The Index — Beta release registry
 * ═════════════════════════════════
 * Single source of truth for the public beta version and its release notes.
 *
 * How to cut a new release:
 *   1. Bump BETA_VERSION (semver-ish: major product milestones change the
 *      major, incremental shipped work bumps the minor).
 *   2. PREPEND a Release entry describing what changed, user-facing.
 *   3. Ship. Every viewer who last saw an older version gets the
 *      "What's new in Beta X.Y" popup once (per version, via localStorage);
 *      brand-new visitors get the "you're viewing a beta" intro once.
 *
 * The badge in the header and footer read from this module, so bumping one
 * constant updates the badge, the popup copy, and the changelog together.
 */

export interface BetaRelease {
  version: string;
  date: string;
  /** One-line headline shown in the popup. */
  headline: string;
  /** What changed — user-facing, no internal jargon. */
  changes: string[];
}

export const BETA_VERSION = "1.2";

/** Newest first. Keep entries user-facing and short. */
export const BETA_RELEASES: BetaRelease[] = [
  {
    version: "1.2",
    date: "2026-09-20",
    headline: "The Index moves to lumiereindex.com",
    changes: [
      "New home: the Index now lives at lumiereindex.com — faster pages, proper search-engine listings, and share links that always land on the canonical site.",
      "Resilience: if the charts' data connection hiccups, the site now says so honestly and recovers automatically instead of hanging.",
      "Under the hood: the chart database keeps itself lean, so refreshing every 15 minutes stays fast as history grows.",
    ],
  },
  {
    version: "1.1",
    date: "2026-09",
    headline: "TV 100 with its own ranking — TVDex",
    changes: [
      "Television gets its own chart: the TV 100, ranked by the TVDex score — television's answer to the movie Index Score.",
      "Genre shelves now list the full catalogue, ranked or not — browsing a genre is no longer limited to chart members.",
    ],
  },
  {
    version: "1.0",
    date: "2026-08",
    headline: "Public beta opens",
    changes: [
      "The Index goes public: Movie 100, Biggest Movers, New Entries, Trending and genre collections, refreshed every 15 minutes.",
      "Share cards, watchlists and film pages ship from day one.",
    ],
  },
];

export const CURRENT_RELEASE: BetaRelease =
  BETA_RELEASES.find((r) => r.version === BETA_VERSION) ?? BETA_RELEASES[0];

/** localStorage keys — namespaced, versioned by design. */
export const LAST_SEEN_VERSION_KEY = "theindex.beta.lastSeenVersion";
export const BETA_INTRO_SEEN_KEY = "theindex.beta.introSeen";

/**
 * What the popup should show for this visitor:
 *  - "intro"  — first visit ever: explain the beta, once.
 *  - "update" — returning viewer whose last-seen version is older: show
 *               what changed in the versions since.
 *  - null     — already seen the current version; stay quiet.
 *
 * localStorage can throw (private mode, disabled storage) — every read is
 * guarded so the badge and popup can never break the page.
 */
export function pendingBetaAnnouncement(): "intro" | "update" | null {
  try {
    const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
    if (lastSeen === null) {
      return localStorage.getItem(BETA_INTRO_SEEN_KEY) ? null : "intro";
    }
    return lastSeen === BETA_VERSION ? null : "update";
  } catch {
    return null;
  }
}

/** Record that the viewer has acknowledged the current version's popup. */
export function markBetaAnnouncementSeen(): void {
  try {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, BETA_VERSION);
    localStorage.setItem(BETA_INTRO_SEEN_KEY, "1");
  } catch {
    /* storage unavailable — the popup simply reappears next visit */
  }
}

/** Releases newer than `fromVersion`, newest first (empty when current). */
export function releasesSince(fromVersion: string): BetaRelease[] {
  const idx = BETA_RELEASES.findIndex((r) => r.version === fromVersion);
  if (idx < 0) return BETA_RELEASES; // unknown old version → show the story
  return BETA_RELEASES.slice(0, idx);
}
