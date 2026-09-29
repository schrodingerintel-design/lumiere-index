/**
 * Adaptive colour — Beta 2.0.
 *
 * The living identity of The Index: the atmosphere around a title inherits a
 * restrained colour derived from its own artwork, so moving from a warm poster
 * to a blue-dominant one visibly shifts the world around it. Ultraviolet
 * remains the product; artwork only tints the air around it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HARD CONSTRAINTS (these are the design system's contract, not suggestions)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. THE COLOUR IS NEVER THE BACKGROUND. The canvas stays #070708 and text
 *    sits on the canvas or a surface. Extracted colour is only ever used as
 *    light — radial washes, halos, edge glows — through the `.amb-*`
 *    utilities. Contrast is therefore structurally independent of the colour.
 *
 * 2. CONSTRAINED EXTRACTION. Raw poster pixels produce muddy browns, neon
 *    greens, blown-out whites and near-blacks, all of which destroy a dark UI.
 *    Every candidate passes through `constrain()`: saturation and luminance
 *    are clamped into a band that stays atmospheric on black.
 *
 * 3. HONEST FALLBACK CHAIN, in order:
 *      a. extracted artwork colour
 *      b. a title-provided theme colour (gradient_from), when present
 *      c. Index ultraviolet #6857FF
 *      d. neutral dark (no wash at all)
 *
 * 4. SSR-SAFE AND FAIL-SILENT. During SSR there is no document, no canvas and
 *    no image decoding, so the engine yields the fallback palette and never
 *    blocks first paint. Every entry point is wrapped so a failure can only
 *    ever leave the page in its fallback state.
 *
 * 5. NO RENDER-TIME IMAGE PROCESSING. Extraction happens once per artwork URL,
 *    off the critical path, at a tiny sample size, and the result is cached
 *    in a module-level Map so re-renders, back-navigation and re-mounts are
 *    free. Nothing runs per frame and nothing runs on every render.
 *
 * 6. REDUCED MOTION IS RESPECTED. Colour drift is a transition; under
 *    `prefers-reduced-motion` the CSS layer disables it globally, and
 *    `prefersReducedMotion()` also lets callers skip the smooth interpolation
 *    bookkeeping entirely.
 */

/** The Index's own colour — the fallback everything returns to. */
export const INDEX_VIOLET = "#6857FF";

/** A resolved atmosphere: two colours plus the intensity to apply them at. */
export interface Ambience {
  /** Primary wash colour. */
  primary: string;
  /** Secondary wash colour, for depth. */
  secondary: string;
  /**
   * Master intensity 0–1. Deliberately capped well below full strength
   * (see `MAX_STRENGTH`) so the wash reads as atmosphere, never as a fill.
   */
  strength: number;
  /** Where this palette came from — useful for tests and debugging. */
  source: "artwork" | "title" | "index" | "neutral";
}

/** The palette used before any artwork has been sampled. */
export const FALLBACK_AMBIENCE: Ambience = {
  primary: INDEX_VIOLET,
  secondary: INDEX_VIOLET,
  strength: 0.34,
  source: "index",
};

/** At no point may the wash exceed this — a background must never result. */
export const MAX_STRENGTH = 0.42;
/** Lower bound keeps the effect visible on very dark, near-monochrome art. */
export const MIN_STRENGTH = 0.18;

/** Sample size for extraction. 32×32 = 1024px read, negligible cost. */
const SAMPLE_SIZE = 32;

// ── colour space helpers ────────────────────────────────────────────────────

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

/**
 * Force a raw extracted colour into the band that is safe on a near-black UI.
 *
 * - Saturation is clamped into a middle band: too low and the atmosphere
 *   disappears, too high and posters produce neon that fights the violet.
 * - Luminance is clamped into a narrow dark-ish band. A bright extracted
 *   colour is darkened rather than used raw, because a light wash on a black
 *   canvas reads as a fog/haze bug, not as atmosphere.
 * - Near-grey pixels (poster backgrounds, black bars, white margins) carry no
 *   usable hue and are rejected by the caller before reaching here.
 */
export function constrain(hex: string): string | null {
  const parsed = parseHex(hex);
  if (!parsed) return null;
  const { h, s, l } = rgbToHsl(parsed);

  // Achromatic pixels are not a palette — they are just the poster's paper.
  if (s < 0.12) return null;

  const constrainedS = clamp(s, 0.35, 0.72);
  // Bias downward: keep the wash unmistakably subordinate to the artwork and
  // the type sitting on top of it.
  const constrainedL = clamp(l * 0.62, 0.28, 0.5);

  return hslToHex(h, constrainedS, constrainedL);
}

function parseHex(input: string): Rgb | null {
  const value = input.trim();
  const hex3 = /^#?([\da-f])([\da-f])([\da-f])$/i.exec(value);
  if (hex3) {
    return {
      r: parseInt(hex3[1] + hex3[1], 16),
      g: parseInt(hex3[2] + hex3[2], 16),
      b: parseInt(hex3[3] + hex3[3], 16),
    };
  }
  const hex6 = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (hex6) {
    return {
      r: parseInt(hex6[1], 16),
      g: parseInt(hex6[2], 16),
      b: parseInt(hex6[3], 16),
    };
  }
  return null;
}

/**
 * Pick the most usable colour from a set of samples, then constrain it.
 *
 * Samples are ranked by chroma (a proxy for "this pixel actually carries a
 * colour") with a mild preference for mid luminance, because pure primary
 * poster colours are often a tiny fraction of the image and the most vivid
 * pixel is frequently a logo or a piece of text.
 */
export function pickDominant(samples: string[]): string | null {
  let best: { hex: string; score: number } | null = null;
  for (const sample of samples) {
    const parsed = parseHex(sample);
    if (!parsed) continue;
    const { s, l } = rgbToHsl(parsed);
    if (s < 0.15) continue;
    // Reject near-black and near-white pixels outright.
    if (l < 0.12 || l > 0.92) continue;
    const midLuminanceBonus = 1 - Math.abs(l - 0.5) * 0.6;
    const score = s * midLuminanceBonus;
    if (!best || score > best.score) best = { hex: sample, score };
  }
  if (!best) return null;
  return constrain(best.hex);
}

/** Derive a secondary, offset hue for depth (complementary-leaning). */
function deriveSecondary(primary: string): string {
  const parsed = parseHex(primary);
  if (!parsed) return INDEX_VIOLET;
  const { h, s, l } = rgbToHsl(parsed);
  return hslToHex(h + 26, clamp(s * 0.85, 0.3, 0.6), clamp(l * 0.9, 0.24, 0.46));
}

/** Build a full ambience from a single usable colour. */
function toAmbience(colour: string, source: Ambience["source"]): Ambience {
  // Stronger chroma earns slightly more presence, within the hard cap.
  const parsed = parseHex(colour);
  const chroma = parsed ? rgbToHsl(parsed).s : 0.4;
  const strength = clamp(
    MIN_STRENGTH + chroma * 0.3,
    MIN_STRENGTH,
    MAX_STRENGTH,
  );
  return { primary: colour, secondary: deriveSecondary(colour), strength, source };
}

// ── extraction ──────────────────────────────────────────────────────────────

/**
 * Module-level cache. Keyed by artwork URL: extraction is a pure function of
 * the image, so one download/one decode serves every future appearance of
 * that title across the whole session. This is what keeps adaptive colour off
 * the render path.
 */
const cache = new Map<string, Ambience>();

/** Read the cache without triggering extraction. */
export function cachedAmbience(url: string | null | undefined): Ambience | null {
  if (!url) return null;
  return cache.get(url) ?? null;
}

/**
 * Store a resolved palette under a caller-chosen key.
 *
 * The mobile sampler downloads a SMALL rendition (it only needs enough pixels
 * to average) but the cache is keyed on the artwork URL the rest of the app
 * knows about. This lets the result be aliased back to that canonical URL so a
 * title is only ever sampled once per session, whichever rendition paid for
 * the download.
 */
export function setCachedAmbience(url: string, ambience: Ambience): void {
  if (!url) return;
  remember(url, ambience);
}

/** Test seam: clear the module cache between assertions. */
export function __resetAdaptiveCacheForTests(): void {
  cache.clear();
}

/** Cache size guard — prevents unbounded growth on very long sessions. */
const MAX_CACHE_ENTRIES = 200;
function remember(key: string, value: Ambience): void {
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/**
 * Sample a downscaled image and return its atmosphere.
 *
 * Runs only in the browser, only once per URL, and never throws. Cross-origin
 * images (TMDB) do taint the canvas — drawing them is fine, but `getImageData`
 * then throws a SecurityError, which we catch and treat as "no artwork
 * colour", falling through to the title colour. The crossOrigin attribute is
 * set by the caller on the <img> that produced the sample; when that is not
 * possible the fallback chain simply engages one step earlier.
 */
export async function extractAmbience(
  imageUrl: string,
  titleColour?: string | null,
): Promise<Ambience> {
  const cached = cache.get(imageUrl);
  if (cached) return cached;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return titleAmbience(titleColour);
  }

  const settled = await new Promise<string | null>((resolve) => {
    let settledFlag = false;
    const finish = (value: string | null) => {
      if (settledFlag) return;
      settledFlag = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    // Never let a slow or unreachable image hold the atmosphere hostage.
    const timer = window.setTimeout(() => finish(null), 4000);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return finish(null);
        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const samples: string[] = [];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          samples.push(
            `#${[data[i], data[i + 1], data[i + 2]]
              .map((v) => v.toString(16).padStart(2, "0"))
              .join("")}`,
          );
        }
        finish(pickDominant(samples));
      } catch {
        // Tainted canvas or decode failure — fall through to the next option.
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = imageUrl;
  });

  const result = settled
    ? toAmbience(settled, "artwork")
    : titleAmbience(titleColour);

  remember(imageUrl, result);
  return result;
}

/** Fallback step 2: a colour the title itself provides. */
function titleAmbience(titleColour?: string | null): Ambience {
  const constrained = titleColour ? constrain(titleColour) : null;
  return constrained
    ? toAmbience(constrained, "title")
    : { ...FALLBACK_AMBIENCE };
}

/**
 * Resolve the atmosphere for a title without doing any image work.
 *
 * Used for SSR and for the very first paint, where the answer must be
 * available synchronously. Returns artwork colour only if it was already
 * cached by a previous extraction — otherwise it walks the honest fallback
 * chain, so SSR renders Index violet and the real colour arrives on hydration.
 */
export function resolveAmbience(input: {
  artworkUrl?: string | null;
  titleColour?: string | null;
}): Ambience {
  const cached = cachedAmbience(input.artworkUrl);
  if (cached) return cached;
  return titleAmbience(input.titleColour);
}

// ── DOM application ─────────────────────────────────────────────────────────

/** True when the visitor has asked the system to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Write an ambience onto an element as CSS custom properties.
 *
 * `--amb-1` / `--amb-2` drive the `.amb-field`, `.amb-halo`, `.amb-surface`
 * and `.amb-edge` utilities. Setting the properties (rather than inline
 * background colours) is what keeps the colour out of the background: the
 * utilities can only ever composite it as light.
 *
 * Returns true when a value was applied.
 */
export function applyAmbience(element: HTMLElement | null, ambience: Ambience): boolean {
  if (!element) return false;
  try {
    element.style.setProperty("--amb-1", ambience.primary);
    element.style.setProperty("--amb-2", ambience.secondary);
    element.style.setProperty("--amb-strength", String(ambience.strength));
    return true;
  } catch {
    return false;
  }
}
