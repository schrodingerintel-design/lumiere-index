import type { ReactNode } from "react";
import { ambienceVars } from "@/lib/ambience";

/**
 * The page surface every interior route sits on.
 *
 * The home page established the idea: a lit plane inside an environment that
 * takes its colour from the leading title. This is that same composition at
 * page scale, so a chart or an article is not a different product from the front
 * door — it is the front door, one level down.
 *
 * When a page HAS a leading title — Movie 100, TV 100, Biggest Movers, the
 * title page itself — its plane is lit by that title's own artwork colours, via
 * the same `ambienceVars` the home page uses. Pages with no leader (the written
 * pages, Compare, the Watchlist) fall back to a neutral cinematic base. Nothing
 * is invented either way: no colour data, no colour.
 */
export function PagePlane({
  lead,
  children,
  wide = false,
}: {
  lead?: { gradient_from?: string | null; gradient_to?: string | null } | null;
  children: ReactNode;
  /** Full-bleed pages (charts, grids) opt out of the reading measure. */
  wide?: boolean;
}) {
  return (
    <div className="ix-page" style={ambienceVars(lead ?? null)}>
      <div className="ix-page__env" aria-hidden="true">
        <div className="ix-page__bloom" />
        <div className="ix-page__depth" />
        <div className="ix-page__grain" />
      </div>
      <div className={wide ? "ix-plane ix-plane--wide" : "ix-plane"}>{children}</div>
      <div className="ix-seam" aria-hidden="true" />
    </div>
  );
}
