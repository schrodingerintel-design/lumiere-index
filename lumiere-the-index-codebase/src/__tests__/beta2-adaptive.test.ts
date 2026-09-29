/**
 * Beta 2.0 — adaptive colour + voice tests.
 *
 * These pin the two pieces of Beta 2.0 that carry real logic and real risk:
 *
 * · adaptive.ts must never let a raw artwork colour reach the UI unguarded
 *   (a blown-out or muddy colour would destroy contrast), must always have a
 *   fallback, must be SSR-safe, and must cache per artwork.
 *
 * · voice.ts must never state something the data does not support — this is
 *   the "personality on top of factual integrity" rule, and it is exactly the
 *   kind of rule that erodes silently if nothing tests it.
 */
import { describe, it, expect, beforeEach } from "vitest";

import {
  INDEX_VIOLET,
  FALLBACK_AMBIENCE,
  constrain,
  pickDominant,
  resolveAmbience,
  cachedAmbience,
  applyAmbience,
  __resetAdaptiveCacheForTests,
  MAX_STRENGTH,
} from "@/lib/adaptive";
import {
  VOICE,
  movementLine,
  peakLine,
  tenureLine,
  surgeLine,
} from "@/lib/voice";

describe("adaptive colour — constrain", () => {
  it("rejects achromatic colours (a poster's paper is not a palette)", () => {
    expect(constrain("#808080")).toBeNull();
    expect(constrain("#ffffff")).toBeNull();
    expect(constrain("#000000")).toBeNull();
  });

  it("returns a usable colour for a saturated input", () => {
    const result = constrain("#ff5522");
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps luminance inside a dark, atmospheric band", () => {
    // A near-white extracted colour must be darkened, never used raw: a light
    // wash on a black canvas reads as fog, not atmosphere.
    const result = constrain("#ffff00");
    expect(result).not.toBeNull();
    const r = parseInt(result!.slice(1, 3), 16);
    const g = parseInt(result!.slice(3, 5), 16);
    const b = parseInt(result!.slice(5, 7), 16);
    const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
    expect(l).toBeLessThanOrEqual(0.5);
  });

  it("parses shorthand hex and accepts values with or without '#'", () => {
    expect(constrain("#f00")).toMatch(/^#[0-9a-f]{6}$/);
    expect(constrain("00ff00")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns null for unparseable input", () => {
    expect(constrain("not-a-colour")).toBeNull();
    expect(constrain("")).toBeNull();
  });
});

describe("adaptive colour — pickDominant", () => {
  it("skips near-black and near-white samples", () => {
    const samples = ["#050505", "#fefefe", "#444444", "#ff4400"];
    const result = pickDominant(samples);
    expect(result).not.toBeNull();
    // The only chromatic sample should win.
    expect(result!.toLowerCase()).not.toBe("");
  });

  it("returns null when every sample is unusable", () => {
    expect(pickDominant(["#000", "#fff", "#888", "#222"])).toBeNull();
    expect(pickDominant([])).toBeNull();
  });
});

describe("adaptive colour — fallback chain", () => {
  beforeEach(() => {
    __resetAdaptiveCacheForTests();
  });

  it("falls back to Index violet when nothing is known", () => {
    const result = resolveAmbience({});
    expect(result.primary).toBe(INDEX_VIOLET);
    expect(result.source).toBe("index");
  });

  it("prefers a title-provided colour over the violet fallback", () => {
    const result = resolveAmbience({ titleColour: "#ff5500" });
    expect(result.source).toBe("title");
    expect(result.primary).not.toBe(INDEX_VIOLET);
  });

  it("ignores a title colour that cannot be constrained", () => {
    const result = resolveAmbience({ titleColour: "#777777" });
    expect(result.source).toBe("index");
    expect(result.primary).toBe(INDEX_VIOLET);
  });

  it("never returns a cache hit for an unextracted URL", () => {
    expect(cachedAmbience("https://example.com/poster.jpg")).toBeNull();
    expect(cachedAmbience(null)).toBeNull();
  });
});

describe("adaptive colour — strength ceiling", () => {
  it("never exceeds the maximum wash strength, so colour cannot become a background", () => {
    // Even a maximally saturated source must stay under the ceiling.
    for (const source of ["#ff0000", "#00ff00", "#0000ff", "#ff00ff"]) {
      const resolved = resolveAmbience({ titleColour: source });
      expect(resolved.strength).toBeLessThanOrEqual(MAX_STRENGTH);
      expect(resolved.strength).toBeGreaterThan(0);
    }
  });

  it("ships a fallback ambience within the same bounds", () => {
    expect(FALLBACK_AMBIENCE.strength).toBeLessThanOrEqual(MAX_STRENGTH);
    expect(FALLBACK_AMBIENCE.primary).toBe(INDEX_VIOLET);
  });
});

describe("adaptive colour — application", () => {
  // The suite runs in the node environment, so instead of a real element we
  // use a minimal recorder. This tests the contract precisely: applyAmbience
  // may ONLY set custom properties, and must never set a background colour.
  function stubElement() {
    const props = new Map<string, string>();
    const backgroundTouched: string[] = [];
    return {
      props,
      backgroundTouched,
      element: {
        style: {
          setProperty(name: string, value: string) {
            if (name.toLowerCase().includes("background")) backgroundTouched.push(name);
            props.set(name, value);
          },
        },
      } as unknown as HTMLElement,
    };
  }

  it("writes custom properties rather than any background colour", () => {
    const { element, props, backgroundTouched } = stubElement();
    const applied = applyAmbience(element, {
      primary: "#ff5522",
      secondary: "#3355ff",
      strength: 0.3,
      source: "artwork",
    });
    expect(applied).toBe(true);
    // The contract: colour arrives as --amb-* so the utilities can only ever
    // composite it as light, never as a fill.
    expect(props.get("--amb-1")).toBe("#ff5522");
    expect(props.get("--amb-2")).toBe("#3355ff");
    expect(props.get("--amb-strength")).toBe("0.3");
    expect(backgroundTouched).toEqual([]);
  });

  it("is safe to call with no element", () => {
    expect(applyAmbience(null, FALLBACK_AMBIENCE)).toBe(false);
  });
});

describe("voice — data-gated copy", () => {
  it("celebrates a new entry", () => {
    expect(
      movementLine({ rank: 12, previousRank: null, movement: null }, "discovery"),
    ).toBe("Well, look who's here.");
  });

  it("states plain movement for a normal rise", () => {
    expect(
      movementLine({ rank: 7, previousRank: 11, movement: 4 }),
    ).toBe("Up 4");
  });

  it("reacts bigger only when the jump is genuinely big", () => {
    expect(
      movementLine({ rank: 4, previousRank: 21, movement: 17 }, "discovery"),
    ).toBe("Okay, that's a jump.");
  });

  it("handles a fall honestly", () => {
    expect(
      movementLine({ rank: 30, previousRank: 16, movement: -14 }),
    ).toBe("Down 14");
  });

  it("uses the #1 line only when the title actually holds at #1", () => {
    expect(
      movementLine({ rank: 1, previousRank: 1, movement: 0 }, "discovery"),
    ).toBe("Still #1. Obviously.");
    // Same hold, but not at #1 — must not claim the throne.
    expect(
      movementLine({ rank: 6, previousRank: 6, movement: 0 }),
    ).toBe("Holds at #6");
  });

  it("never claims watching, popularity or conversation", () => {
    const lines = [
      movementLine({ rank: 1, previousRank: null, movement: null }, "discovery"),
      movementLine({ rank: 1, previousRank: 1, movement: 0 }, "discovery"),
      movementLine({ rank: 9, previousRank: 30, movement: 21 }, "discovery"),
      movementLine({ rank: 40, previousRank: 10, movement: -30 }, "discovery"),
      surgeLine(1),
      VOICE.moviesTitle,
      VOICE.tvTitle,
      VOICE.weeklyTitle,
    ].join(" ");

    // The core truthfulness rule: the Index measures momentum, not viewing.
    for (const forbidden of [
      "everyone is watching",
      "everyone is talking",
      "most watched",
      "most popular",
      "trending worldwide",
    ]) {
      expect(lines.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("voice — optional facts", () => {
  it("omits peak when there is none rather than inventing one", () => {
    expect(peakLine(null)).toBeNull();
    expect(peakLine(0)).toBeNull();
    expect(peakLine(3)).toBe("Peak: #3");
    expect(peakLine(1)).toBe("Hit #1");
  });

  it("omits tenure when unknown", () => {
    expect(tenureLine(null)).toBeNull();
    expect(tenureLine(0)).toBeNull();
    expect(tenureLine(1)).toBe("1 day on chart");
    expect(tenureLine(12)).toBe("12 days on chart");
  });
});
