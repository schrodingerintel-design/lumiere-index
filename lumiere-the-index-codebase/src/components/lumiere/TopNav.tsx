import { Link } from "@tanstack/react-router";
import { Menu, Search } from "lucide-react";
import { BrandLink } from "@/components/lumiere/Brand";
import { useChrome } from "@/components/lumiere/chrome-context";

/**
 * The one header.
 *
 * There is no second bar anywhere in the product: this component renders the
 * whole of it, and it renders as a single element with a single desktop row and
 * a single phone row (CSS shows exactly one of the two).
 *
 * `tone` is the only thing that changes between pages:
 *
 *   ink    — every page, on the site's own black. Light type.
 *   panel  — Home, drawn on the luminous plane at the top of the composition.
 *            Dark ink type on glass.
 *
 * Both tones share the same geometry and the same destinations, so the header
 * belongs to one product rather than two. Nothing here is a pill switch, a
 * capsule, a tab strip or a dashboard control: plain type, one hairline of
 * active state, one search affordance, one live stamp.
 *
 * Desktop shows the destinations inline; on a phone the wordmark, the live
 * state and a menu trigger remain, and the destinations live in the bottom tab
 * bar and the side drawer.
 */
const NAV_LINKS = [
  { to: "/top-100", label: "Movie 100" },
  { to: "/tv-100", label: "TV 100" },
  { to: "/weekly-100", label: "Weekly 100" },
  { to: "/rising", label: "Biggest Movers" },
] as const;

function LiveMark() {
  return (
    <span className="ix-live">
      <i aria-hidden />
      Live
    </span>
  );
}

export function TopNav({ tone = "ink" }: { tone?: "ink" | "panel" }) {
  const { openMenu, openSearch } = useChrome();

  return (
    <header className={`ix-topbar ix-topbar--${tone}`}>
      {/* Phone: wordmark + live state + drawer trigger. Hidden on desktop. */}
      <div className="ix-topbar__m">
        <BrandLink className="ix-wordmark" />
        <LiveMark />
        <button type="button" onClick={openMenu} className="ix-menu-btn">
          <Menu aria-hidden />
          Menu
        </button>
      </div>

      {/* Desktop: wordmark, the four primary charts, search, live state. */}
      <div className="ix-topbar__d">
        <BrandLink className="ix-wordmark" />
        <nav className="ix-nav" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="ix-nav__link"
              activeProps={{ className: "is-active" }}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={openSearch}
            className="ix-nav__search"
            aria-label="Search"
          >
            <Search aria-hidden />
          </button>
        </nav>
        <LiveMark />
      </div>
    </header>
  );
}
