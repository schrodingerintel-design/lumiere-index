import { Link } from "@tanstack/react-router";
import { Menu, Search } from "lucide-react";
import { BrandLink } from "@/components/lumiere/Brand";

/**
 * Primary navigation.
 *
 * Desktop is a single inline pill switch — there is no hamburger on a wide
 * screen. On a phone the bar collapses to the wordmark plus a menu trigger;
 * the primary destinations move to the bottom tab bar and the secondary ones
 * into the side drawer, both rendered by Layout.
 *
 * Every entry is an existing route in The Index. Nothing is invented here.
 */
const PILL_LINKS = [
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

export function TopNav({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  return (
    <header className="ix-topbar">
      {/* Phone: wordmark + live state + drawer trigger */}
      <div className="ix-topbar__m">
        <BrandLink className="ix-wordmark" />
        <LiveMark />
        <button type="button" onClick={onMenu} className="ix-menu-btn">
          <Menu aria-hidden />
          Menu
        </button>
      </div>

      {/* Desktop: inline pill switch */}
      <div className="ix-topbar__d">
        <BrandLink className="ix-wordmark" />
        <nav className="ix-switch" aria-label="Primary">
          {PILL_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="ix-switch__link" activeProps={{ className: "is-active" }}>
              {link.label}
            </Link>
          ))}
          <button type="button" onClick={onSearch} className="ix-switch__search" aria-label="Search">
            <Search aria-hidden />
          </button>
        </nav>
        <LiveMark />
      </div>
    </header>
  );
}
