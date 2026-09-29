/**
 * Beta 2.0 — the adaptive ambience hook.
 *
 * Bridges `lib/adaptive.ts` to React. The pattern is deliberate:
 *
 *   1. Resolve SYNCHRONOUSLY first (cached colour or the honest fallback), so
 *      the very first paint — including SSR — is correct and never blank.
 *   2. Then, only in the browser, sample the artwork off the critical path and
 *      upgrade the palette when the result arrives.
 *
 * This ordering is what keeps the site fast: the UI never waits on an image
 * decode to render, and because the palette is cached per artwork URL, moving
 * back to a title the visitor has already seen is instantaneous.
 *
 * The hook also owns the transition-length contract: under reduced motion it
 * writes the palette without any transition, so the atmosphere snaps instead of
 * drifting.
 */
import { useEffect, useRef, useState } from "react";

import {
  applyAmbience,
  cachedAmbience,
  extractAmbience,
  prefersReducedMotion,
  resolveAmbience,
  setCachedAmbience,
  type Ambience,
} from "@/lib/adaptive";
import { tmdbAtSize } from "@/lib/apiClient";

export interface AmbienceTarget {
  /** Artwork to sample. Backdrop preferred, poster is a fine substitute. */
  artworkUrl?: string | null;
  /** A colour the title itself provides (backend gradient_from). */
  titleColour?: string | null;
}

/**
 * The sampler draws the whole image into a 32x32 canvas, so the only thing it
 * needs is enough pixels to average — not the 1280px backdrop the page is
 * already displaying. Handing it a small rendition stops the ambience pass
 * from becoming a second full-size image download behind the hero, which is
 * exactly the kind of hidden cost §18 is about.
 *
 * 185px is far more than a 32x32 average needs, and it is already the smallest
 * rung of the page's own poster srcset, so in practice this is a cache hit
 * rather than a new request.
 */
const SAMPLE_SIZE_URL = "w185";

/** Pick the cheapest rendition of `url` that still samples accurately. */
function samplingUrl(url: string): string {
  return tmdbAtSize(url, SAMPLE_SIZE_URL) ?? url;
}

/** Store a resolved palette under an alias key in the shared cache. */
function cacheAmbienceFor(alias: string, ambience: Ambience): void {
  try {
    setCachedAmbience(alias, ambience);
  } catch {
    // The cache is a bounded optimisation; a failure here must never break
    // the ambience upgrade.
  }
}

/**
 * Resolve the ambience for a target and keep it in sync as the target changes.
 *
 * Returns the current palette. Callers hand it to `applyAmbience` on a ref'd
 * element, or pass it to `<AmbienceSurface>`.
 */
export function useAmbience(target: AmbienceTarget): Ambience {
  const { artworkUrl = null, titleColour = null } = target;

  // Synchronous first value: cached artwork colour, else the fallback chain.
  // `resolveAmbience` is pure, so this is safe during SSR and during render.
  const [ambience, setAmbience] = useState<Ambience>(() =>
    resolveAmbience({ artworkUrl, titleColour }),
  );

  // Guards against a slow extraction resolving after the target moved on.
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;

    // Re-resolve synchronously whenever the target changes, so switching
    // heroes never leaves the previous title's colour on screen for a frame.
    setAmbience(resolveAmbience({ artworkUrl, titleColour }));

    if (!artworkUrl) return;

    // Already known (e.g. revisiting a title) — nothing to sample.
    if (cachedAmbience(artworkUrl)) return;

    // The cache is keyed on the ORIGINAL url (so a title sampled once stays
    // sampled), but the download uses the cheap rendition.
    const source = samplingUrl(artworkUrl);
    let cancelled = false;
    void extractAmbience(source, titleColour).then((next) => {
      if (cancelled || id !== requestId.current) return;
      // Re-key the result under the original URL so revisiting this title
      // skips sampling entirely.
      if (source !== artworkUrl) cacheAmbienceFor(artworkUrl, next);
      setAmbience(next);
    });

    return () => {
      cancelled = true;
    };
  }, [artworkUrl, titleColour]);

  return ambience;
}

/**
 * Imperative application helper.
 *
 * Writes the palette onto an element as CSS custom properties. Under reduced
 * motion the transition is stripped so the change is instant rather than a
 * slow drift the visitor did not ask for.
 */
export function useAmbienceStyle(
  ambience: Ambience,
  ref: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    applyAmbience(element, ambience);

    if (prefersReducedMotion()) {
      // Neutralise the CSS transition for this element only.
      element.style.setProperty("--amb-ease", "0ms");
    } else {
      element.style.removeProperty("--amb-ease");
    }
  }, [ambience, ref]);
}
