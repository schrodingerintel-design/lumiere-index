import { Link } from "@tanstack/react-router";

/**
 * Discovery, as one quiet line under the hero.
 *
 * This used to be five large boxed buttons, which read as a control panel and
 * promoted secondary destinations to the same weight as the chart itself. It is
 * now a single row of plain links set in the plane's own type — the same words,
 * the same routes, no boxes and no icons.
 *
 * Search is not here: it is in the header, in both tones. Genres is not here
 * either: it belongs to browsing, not to the front door, and it stays in the
 * side drawer and the footer.
 */
const LINKS = [
  { to: "/new-entries", label: "New Entries" },
  { to: "/trending", label: "Trending" },
  { to: "/calendar", label: "Now & Next" },
] as const;

export function HomeRail() {
  return (
    <nav className="ix-rail" aria-label="More of The Index">
      <span className="ix-rail__label">Elsewhere</span>
      <ul className="ix-rail__list">
        {LINKS.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="ix-rail__link">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
