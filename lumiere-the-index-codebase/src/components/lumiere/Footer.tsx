import { Link } from "@tanstack/react-router";
import { BrandLink } from "@/components/lumiere/Brand";
import { AdConsentSettings } from "@/components/lumiere/AdConsentBanner";

/**
 * The foot of the product.
 *
 * Written for this direction rather than adapted from the previous editorial
 * footer: no four-column grid, no uppercase column headings, no Beta badge, no
 * social buttons, no heavy rules. It is a single quiet plane on the same ink
 * the home composition resolves to, so the page reads as one continuous object
 * from the first pixel to the last.
 *
 * Two rows do all the work: the wordmark and a line of destinations, then a
 * hairline and the small print. Every destination is a route that already
 * exists.
 */
const LINKS = [
  { to: "/top-100", label: "Movie 100" },
  { to: "/tv-100", label: "TV 100" },
  { to: "/weekly-100", label: "Weekly 100" },
  { to: "/rising", label: "Biggest Movers" },
  { to: "/new-entries", label: "New Entries" },
  { to: "/trending", label: "Trending" },
  { to: "/genres", label: "Genres" },
  { to: "/calendar", label: "Now & Next" },
  { to: "/about", label: "About" },
  { to: "/methodology", label: "Methodology" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
] as const;

export function Footer() {
  return (
    <footer className="ix-foot">
      <div className="ix-foot__inner">
        <div className="ix-foot__top">
          <div className="ix-foot__brand">
            <BrandLink />
            <p className="ix-foot__lede">
              A live chart of culture. What film and television the world is
              looking at right now, refreshed every 15 minutes.
            </p>
          </div>

          <nav aria-label="All destinations">
            <ul className="ix-foot__links">
              {LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="ix-foot__link" activeProps={{ className: "is-active" }}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="ix-foot__base">
          <span>© {new Date().getFullYear()} The Index by Lumière</span>
          <span className="ix-foot__stamp">
            Updated every 15 minutes <AdConsentSettings />
          </span>
        </div>
      </div>
    </footer>
  );
}
