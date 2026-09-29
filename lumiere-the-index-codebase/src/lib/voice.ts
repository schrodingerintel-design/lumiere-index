/**
 * Product voice — Beta 2.0.
 *
 * One module owns every consumer-facing line, so the personality is tunable in
 * one place and no component invents its own register.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULE THAT OVERRIDES EVERYTHING ELSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Never trade accuracy for a fun sentence.
 *
 * The Index measures cultural MOMENTUM across measured sources. It does not
 * measure how many people are watching, how much they liked something, or what
 * anyone is saying. So "Everyone is watching…" is not a stylistic choice, it
 * is a false claim about the product's own methodology.
 *
 * Every dynamic line below is therefore DATA-GATED: a phrase can only be
 * selected when the underlying field genuinely supports it. A title that rose 4
 * places can be "Moving up. Fast." A title that merely holds at #1 cannot.
 * The gate is the function; the copy bank is just options.
 *
 * ── Register by context (§25) ──────────────────────────────────────────────
 *   discovery  — most playful. Where the product gets to be funny.
 *   chart      — concise and confident. Numbers, verbs, no jokes.
 *   history    — slightly storytelling. "The run", "The receipts".
 *   error      — human and slightly informal, never unserious.
 *   legal      — calm, literal, no jokes. Never the playful bank.
 *
 * Methodology deliberately does NOT use this module. Those pages stay precise,
 * technical and restrained; the playful voice must never explain a ranking
 * system.
 */

/** Context a line is being written for. Legal never draws from playful copy. */
export type VoiceRegister = "discovery" | "chart" | "history" | "error" | "legal";

// ── static copy ─────────────────────────────────────────────────────────────

export const VOICE = {
  /** Search affordance. */
  searchPlaceholder: "Search culture",

  /** Chart section headers. */
  moviesTitle: "The movies taking over right now.",
  tvTitle: "What's taking over TV?",
  weeklyTitle: "The week in culture.",

  /** Module headers. */
  moversTitle: "Things escalated.",
  newEntriesTitle: "Fresh on the chart.",
  historyTitle: "The run",
  recordsTitle: "The receipts",

  /** Hero eyebrow — answers "what is this" in three words. */
  heroEyebrow: "What matters right now",
  heroUpdated: (minutes: number) => `Updated ${minutes}m ago`,

  /** Empty / error states. */
  noResults: "Yeah, we couldn't find that.",
  chartsUnavailable:
    "We hit a problem loading the charts. Try again in a sec.",
  errorTitle: "Well, that didn't work.",
  errorBody:
    "We hit a problem loading this page. Try again in a sec.",

  /** Legal / consent — literal and calm. */
  rankingIndependence:
    "Advertisers have no influence on The Index rankings or chart positions.",
} as const;

/** New-leader announcement. Only fires when the leader actually changes. */
export const newNumberOne = "We have a new #1.";

// ── data-gated dynamic copy ─────────────────────────────────────────────────

/**
 * How a title is moving. Derived from published chart data only.
 * `undefined` means we lack the data and must not editorialise.
 */
export interface MovementFacts {
  rank: number;
  previousRank: number | null;
  movement: number | null;
  peakRank?: number | null;
  daysOnChart?: number | null;
  isNewEntry?: boolean;
}

/**
 * A movement line, chosen from what the data actually proves.
 *
 * The order is deliberate: newness and return beat a size of jump, which beats
 * a long #1 run, which beats a plain hold. A title never gets two jokes.
 */
export function movementLine(
  facts: MovementFacts,
  register: VoiceRegister = "chart",
): string {
  const { previousRank, movement, rank, daysOnChart } = facts;

  if (facts.isNewEntry || previousRank == null) {
    return register === "discovery" ? "Well, look who's here." : "New";
  }

  const moved = movement ?? 0;

  if (moved > 0) {
    // A genuinely large jump earns the more playful line; small ones stay plain.
    if (register === "discovery" && moved >= 10) return "Okay, that's a jump.";
    if (register === "history") return "Then it came back.";
    return `Up ${moved}`;
  }

  if (moved < 0) {
    if (register === "discovery" && moved <= -10) return "Okay. That went fast.";
    return `Down ${Math.abs(moved)}`;
  }

  // Held position.
  if (rank === 1) {
    if (register === "discovery") return "Still #1. Obviously.";
    if ((daysOnChart ?? 0) >= 14) return "Still here.";
    return "#1 right now";
  }

  if (register === "history" && (daysOnChart ?? 0) >= 14) {
    return "Having a week.";
  }
  return `Holds at #${rank}`;
}

/** English pluralisation for the one noun the chart surfaces actually need. */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Peak position, stated only when the data has one. */
export function peakLine(peakRank: number | null | undefined): string | null {
  if (!peakRank || peakRank <= 0) return null;
  if (peakRank === 1) return "Hit #1";
  return `Peak: #${peakRank}`;
}

/** Tenure, in the honest unit. The live chart refreshes every 15 minutes, so
 *  days is the truthful measure of how long a title has been charting. */
export function tenureLine(daysOnChart: number | null | undefined): string | null {
  const days = daysOnChart ?? 0;
  if (days <= 0) return null;
  return days === 1 ? "1 day on chart" : `${days} days on chart`;
}

/**
 * A true statement about a surge, phrased without implying we know why.
 * Used only for SURGING titles, which the backend derived from trajectory.
 */
export function surgeLine(rank: number): string {
  return rank <= 10 ? "Surging" : "Moving up. Fast.";
}
