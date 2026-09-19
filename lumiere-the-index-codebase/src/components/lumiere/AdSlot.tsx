/**
 * The Index — AdSlot
 * ══════════════════
 * The single reusable advertising surface. Every future advertisement on the
 * site renders through this component with a placement id from the registry:
 *
 *   <AdSlot placement="top100-after-20" />
 *
 * Behaviour contract:
 *  - ADS_ENABLED=false (current state) → renders NOTHING. No container, no
 *    reserved space, no placeholder, no script. The page is byte-identical
 *    in layout terms to a build without this component in the tree.
 *  - Placement disabled → renders nothing.
 *  - Dev slot preview (VITE_SHOW_AD_SLOTS=true, dev builds only) → a subtle
 *    outlined box labelled "AD SLOT · <placement>" to verify spacing and
 *    responsive behaviour. Never rendered in production builds.
 *  - Ads enabled + slot loading (lazy) → a quiet reserved region sized per
 *    breakpoint so filling never shifts layout (CLS protection), with the
 *    required "Advertisement" label so it can never be mistaken for a rank,
 *    a recommendation, or an Index Score.
 *  - Ad unavailable / slow → the reserved region stays quiet; nothing breaks.
 *
 * VISUAL CONTRACT: an AdSlot must never be visually confused with a ranked
 * title. It renders no rank number, no Index/TVDex score, no movement arrow,
 * no poster, and no title typography — only the Google-mandated label and
 * (when enabled) the creative itself.
 */
import { useEffect, useRef, useState } from "react";
import {
  ADS_ENABLED,
  ADSENSE_CLIENT,
  SHOW_AD_SLOTS_DEV,
  getPlacement,
} from "@/lib/ads/config";
import { loadAdSenseScript, adSenseLoadStatus } from "@/lib/ads/adsense";

/** Dev-only guard: slot preview can never activate in a production build. */
const IS_PROD_BUILD = import.meta.env.PROD;

/** Whether a placement will currently render anything. Pages use this to
 *  skip wrappers (e.g. <li> rows in charts) so the DOM stays pristine —
 *  zero containers exist while advertising is disabled. */
export function isAdSlotActive(placement: string): boolean {
  const c = getPlacement(placement);
  if (!c) return false;
  if (SHOW_AD_SLOTS_DEV && !IS_PROD_BUILD) return true;
  return Boolean(c.enabled && ADS_ENABLED);
}

export function AdSlot({ placement }: { placement: string }) {
  const config = getPlacement(placement);

  // All hooks run unconditionally (rules of hooks); every branch below is a
  // pure render decision.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(!config?.lazy);

  useEffect(() => {
    if (!config?.lazy || inView) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      // Start loading ~600px before the slot scrolls into view so a filled
      // ad is usually ready by the time it is seen (no giant blank region).
      { rootMargin: "600px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [config?.lazy, inView]);

  const shouldLoad = Boolean(
    config?.enabled && ADS_ENABLED && inView,
  );

  useEffect(() => {
    if (shouldLoad) loadAdSenseScript();
  }, [shouldLoad]);

  // ── Developer slot preview (dev builds only) ─────────────────────────
  // Checked BEFORE the disabled return: the preview exists precisely to
  // verify spacing while advertising is still disabled. Production builds
  // never render it (IS_PROD_BUILD hard-gate).
  if (SHOW_AD_SLOTS_DEV && !IS_PROD_BUILD && config) {
    return (
      <div
        data-ad-slot={config.id}
        aria-hidden="true"
        className="my-6 flex min-h-[90px] items-center justify-center border border-dashed border-foreground/25 bg-foreground/[0.03] px-4 py-3"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          AD SLOT · {config.id}
        </span>
      </div>
    );
  }

  // ── Disabled: render absolutely nothing ──────────────────────────────
  // No wrapper, no min-height, no reserved space, no placeholder.
  if (!config || !config.enabled || !ADS_ENABLED) return null;

  // ── Real ad surface ────────────────────────────────────────────────
  const status = adSenseLoadStatus();
  const ready = status.allowed; // library may load — a creative can appear

  return (
    <div
      ref={containerRef}
      data-ad-slot={config.id}
      data-ad-status={ready ? (inView ? "loading" : "idle") : "blocked"}
      // Never a click/keyboard target: ads are not interactive product UI.
      role="complementary"
      aria-label="Advertisement"
      // Static Tailwind classes (never interpolated) so the JIT compiler sees
      // them. Mobile gets its own fluid unit; desktop a wider horizontal one.
      className="mx-auto w-full min-h-[100px] px-4 py-6 sm:px-6 lg:min-h-[120px]"
    >
      {ready && inView ? (
        // AdSense ins element — populated by the library once loaded.
        // Kept deliberately bare: no rank typography, no score, no poster.
        <ins
          className="adsbygoogle block"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT || undefined}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : null}
    </div>
  );
}
