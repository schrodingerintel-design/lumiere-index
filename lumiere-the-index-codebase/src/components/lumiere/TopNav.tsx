import { Link } from "@tanstack/react-router";
import { Menu, Search, Sun, Moon } from "lucide-react";
import { NAV_ITEMS } from "./Sidebar";
import { useTheme } from "@/hooks/use-theme";

const topLinks = NAV_ITEMS.filter(
  (item) =>
    item.to !== "/" &&
    item.to !== "/watchlist" &&
    item.to !== "/genres" &&
    item.to !== "/calendar" &&
    item.to !== "/about",
).map(({ to, label }) => ({ to, label }));

export function TopNav({ onMenu, onSearch }: { onMenu: () => void; onSearch?: () => void }) {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 lg:px-4">
      <div className="glass mx-auto flex h-13 min-h-11 items-center justify-between rounded-full px-2.5 sm:px-3 lg:px-5">
        <div className="flex items-center gap-1.5">
          {/* Menu button — 44px touch target on mobile */}
          <button
            onClick={onMenu}
            aria-label="Open navigation menu"
            className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-foreground/10 active:bg-foreground/15 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="font-display text-lg lg:hidden">
            Lumière<span className="text-primary">.</span>
          </Link>
          <nav className="hidden items-center gap-4 lg:flex">
            {topLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-[13px] uppercase tracking-wider text-foreground/70 transition hover:text-foreground"
                activeProps={{ className: "text-primary font-medium" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Search trigger — solid, readable surface (not glass theatre); full
            44px target on mobile where it renders as an icon button. */}
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search films"
          className="mx-1 flex h-11 items-center gap-2 rounded-full border border-foreground/20 bg-background/85 px-3.5 text-sm text-muted-foreground backdrop-blur transition hover:border-primary/60 hover:text-foreground md:mr-1 md:w-44 md:justify-start lg:w-52"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden truncate md:inline">Search films&hellip;</span>
        </button>

        <div className="flex items-center gap-1">
          {/* Theme toggle — 44px touch target */}
          <button
            onClick={toggle}
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {/* Live · Updating — the Index recomputes continuously (desktop+) */}
          <div
            title="Live signal engine — rankings update continuously from 86,000+ audience signals across Reddit, Letterboxd, news & social channels."
            className="hidden md:flex items-center gap-2 rounded-full border border-live/30 bg-live/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-live transition-all hover:bg-live/20 cursor-help"
          >
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
            <span>Live · Updating</span>
          </div>
        </div>
      </div>
    </header>
  );
}
