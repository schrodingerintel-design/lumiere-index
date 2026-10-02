import type { RankedFilm } from "@/lib/apiClient";
import { ambienceVars } from "@/lib/ambience";
import { backdropAt } from "@/lib/tmdbImage";

/**
 * The environment behind the home page.
 *
 * Six stacked layers: a deep base, the leading title's real backdrop washed
 * and diffused, three colour-diffusion sources derived from that title, a
 * horizon wash, the bend to the site's own ink, and grain.
 *
 * The colour comes from the leading title's `gradient_from` / `gradient_to`,
 * so the page resolves to the site's black (`--color-ink`, the same background
 * every other page sits on) as it scrolls toward the footer.
 */
export function HomeEnvironment({ lead }: { lead: RankedFilm | null }) {
  const wash = backdropAt(lead?.backdrop_url, "w780");

  return (
    <div className="ix-env" style={ambienceVars(lead)} aria-hidden="true">
      {wash ? (
        <div className="ix-env__wash" style={{ backgroundImage: `url(${wash})` }} />
      ) : (
        <div className="ix-env__wash ix-env__wash--empty" />
      )}
      <div className="ix-env__bloom" />
      <div className="ix-env__horizon" />
      <div className="ix-env__depth" />
      <div className="ix-env__vig" />
      <div className="ix-env__grain" />
    </div>
  );
}
