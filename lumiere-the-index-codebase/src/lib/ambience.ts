/**
 * Adaptive ambience.
 *
 * The environment behind the home page takes its colour from whichever title is
 * currently leading the chart. Those colours come from the `gradient_from` /
 * `gradient_to` fields the API already returns for every ranked title — real
 * per-title colour, computed by the catalog. No client-side image sampling and
 * no canvas, so it is free, SSR-safe and correct on first paint.
 *
 * Values are emitted as bare "r g b" triplets so CSS can compose them as
 * `rgb(var(--ix-a1) / 0.5)`.
 */

const COOL_BASE: RGB = { r: 96, g: 104, b: 136 };
const COOL_BASE_DEEP: RGB = { r: 72, g: 82, b: 116 };
const LIGHT_BASE: RGB = { r: 214, g: 220, b: 236 };

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** "#4a1525" -> { r: 74, g: 21, b: 37 }. Returns null for anything unusable. */
export function parseHex(hex: string | null | undefined): RGB | null {
  if (!hex) return null;
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a: RGB, b: RGB, weight: number): RGB {
  return {
    r: Math.round(a.r * weight + b.r * (1 - weight)),
    g: Math.round(a.g * weight + b.g * (1 - weight)),
    b: Math.round(a.b * weight + b.b * (1 - weight)),
  };
}

function triplet(c: RGB): string {
  return `${c.r} ${c.g} ${c.b}`;
}

/**
 * Three atmosphere channels for a leading title.
 *
 * The artwork colours are lifted toward a cool cinematic base rather than used
 * raw: a saturated poster wash would fight the frosted panel and wreck text
 * contrast. `a3` is a near-neutral light used only for the panel's rim light,
 * so it stays close to the site's cream rather than picking up poster colour.
 */
export function ambienceVars(film: {
  gradient_from?: string | null;
  gradient_to?: string | null;
} | null): React.CSSProperties {
  const from = parseHex(film?.gradient_from);
  const to = parseHex(film?.gradient_to);

  // Neutral cinematic fallback when a title carries no colour data.
  const a1 = from ? mix(from, COOL_BASE, 0.56) : COOL_BASE;
  const a2 = to ? mix(to, COOL_BASE_DEEP, 0.52) : COOL_BASE_DEEP;
  const a3 = from ? mix(from, LIGHT_BASE, 0.74) : LIGHT_BASE;

  return {
    ["--ix-a1" as string]: triplet(a1),
    ["--ix-a2" as string]: triplet(a2),
    ["--ix-a3" as string]: triplet(a3),
  };
}
