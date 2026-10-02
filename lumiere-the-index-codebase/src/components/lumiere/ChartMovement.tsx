import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { RankedFilm } from "@/lib/apiClient";

/**
 * Rank movement — arrow plus number.
 *
 * Derived from the chart's own published movement (previous chart period) and
 * never fabricated. Rendered in the plane's movement language, the same amber
 * and blue the home page uses for a climbing or falling title, so a chart row
 * here and a poster card there say the same thing with the same marks.
 *
 * The arrow carries the direction, so the meaning never rests on colour alone.
 */
export function Movement({ film }: { film: RankedFilm }) {
  const change = film.movement ?? 0;

  if (film.prev_rank == null) {
    return (
      <span className="ix-delta ix-delta--new" title="First appearance on The Index">
        New
      </span>
    );
  }
  if (change > 0) {
    return (
      <span className="ix-delta ix-delta--up" title={`Up ${change} since the previous chart`}>
        <ArrowUp aria-hidden />
        {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span
        className="ix-delta ix-delta--down"
        title={`Down ${Math.abs(change)} since the previous chart`}
      >
        <ArrowDown aria-hidden />
        {Math.abs(change)}
      </span>
    );
  }
  return (
    <span className="ix-delta ix-delta--flat" title="Held its rank">
      <Minus aria-hidden />0
    </span>
  );
}
