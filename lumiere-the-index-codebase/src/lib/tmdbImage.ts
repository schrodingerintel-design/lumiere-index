/**
 * TMDB image sizing.
 *
 * The API returns fully-qualified `image.tmdb.org` URLs at a fixed width. These
 * helpers rewrite the size segment so each slot can request exactly what it
 * renders at, and build a srcset so phones never download desktop pixels.
 *
 * Falls back to the original URL untouched if the path is not a TMDB asset, so
 * a non-TMDB `poster_url` still renders.
 */

type PosterSize = "w185" | "w342" | "w500" | "original";
type BackdropSize = "w500" | "w780" | "w1280" | "original";

function resize(url: string | null | undefined, size: string): string | null {
  if (!url) return null;
  return url.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`);
}

export function posterAt(url: string | null | undefined, size: PosterSize = "w342") {
  return resize(url, size);
}

export function backdropAt(url: string | null | undefined, size: BackdropSize = "w1280") {
  return resize(url, size);
}

/** Responsive ladder for a poster tile. */
export function posterSrcSet(url: string | null | undefined) {
  if (!url) return undefined;
  return (["w185", "w342", "w500"] as PosterSize[])
    .map((s) => `${resize(url, s)} ${s.replace("w", "")}w`)
    .join(", ");
}

/** Responsive ladder for a backdrop. `original` has no width descriptor. */
export function backdropSrcSet(url: string | null | undefined) {
  if (!url) return undefined;
  return (["w500", "w780", "w1280"] as BackdropSize[])
    .map((s) => `${resize(url, s)} ${s.replace("w", "")}w`)
    .join(", ");
}
