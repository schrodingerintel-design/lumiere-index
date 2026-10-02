import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Clapperboard,
  Film,
  Home,
  Info,
  Lock,
  ScrollText,
  Search,
  Sparkles,
  Tags,
  TrendingUp,
  Tv,
  X,
  CalendarRange,
} from "lucide-react";
import { Brand } from "./Brand";

/** Bottom navigation on a phone: the five primary destinations, always in the
 *  same order, always in thumb reach. */
const TABS = [
  { to: "/", label: "Home", Icon: Home, exact: true },
  { to: "/top-100", label: "Movies", Icon: Film },
  { to: "/tv-100", label: "TV", Icon: Tv },
  { to: "/weekly-100", label: "Weekly", Icon: CalendarRange },
] as const;

export function MobileTabBar({ onSearch }: { onSearch: () => void }) {
  return (
    <nav className="ix-tabbar" aria-label="Primary">
      {TABS.map(({ to, label, Icon, ...rest }) => (
        <Link
          key={to}
          to={to}
          className="ix-tab"
          activeOptions={{ exact: (rest as { exact?: boolean }).exact ?? false }}
          activeProps={{ className: "is-active" }}
        >
          <Icon aria-hidden />
          {label}
        </Link>
      ))}
      <button type="button" onClick={onSearch} className="ix-tab">
        <Search aria-hidden />
        Search
      </button>
    </nav>
  );
}

/** Secondary destinations, behind a side drawer on a phone. These are the same
 *  pages the desktop footer carries — nothing is added. */
const DRAWER_GROUPS = [
  {
    heading: "Charts",
    links: [
      { to: "/rising", label: "Biggest Movers", Icon: TrendingUp },
      { to: "/new-entries", label: "New Entries", Icon: Sparkles },
      { to: "/trending", label: "Trending", Icon: Clapperboard },
      { to: "/genres", label: "Genres", Icon: Tags },
      { to: "/calendar", label: "Now & Next", Icon: CalendarDays },
    ],
  },
  {
    heading: "The Index",
    links: [
      { to: "/about", label: "About", Icon: Info },
      { to: "/methodology", label: "Methodology", Icon: ScrollText },
      { to: "/privacy", label: "Privacy", Icon: Lock },
      { to: "/terms", label: "Terms", Icon: ScrollText },
    ],
  },
] as const;

export function SideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mounted only while open — unmounting guarantees no invisible layer traps taps.
  if (!open) return null;

  return (
    <div className="ix-drawer">
      <div className="ix-drawer__scrim" onClick={onClose} aria-hidden />
      <aside className="ix-drawer__sheet" aria-label="More destinations">
        <div className="ix-drawer__hd">
          <Brand />
          <button type="button" onClick={onClose} className="ix-drawer__x" aria-label="Close menu">
            <X aria-hidden />
          </button>
        </div>

        <div className="ix-drawer__scroll">
          {DRAWER_GROUPS.map((group) => (
            <div key={group.heading} className="ix-drawer__group">
              <b>{group.heading}</b>
              {group.links.map(({ to, label, Icon }) => (
                <Link key={to} to={to} onClick={onClose} className="ix-drawer__link">
                  <Icon aria-hidden />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="ix-drawer__foot">A live chart of culture · updated every 15 minutes</div>
      </aside>
    </div>
  );
}
