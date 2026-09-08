import { Link } from "@tanstack/react-router";
import { Menu, Search, Sun, Moon } from "lucide-react";
import { NAV_ITEMS } from "./Sidebar";
import { useTheme } from "@/hooks/use-theme";

/** Editorial date — e.g. "Monday, September 8, 2026" (publication masthead). */
function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Primary destinations only — secondary ones (Watchlist, Compare, Now & Next,
// About) live in the sidebar and footer. Navigation is functional, not a show.
const topLinks = NAV_ITEMS.filter(
  (item) =>
    item.to !== "/" &&
    item.to !== "/watchlist" &&
    item.to !== "/genres" &&
    item.to !== "/calendar" &&
    item.to !== "/compare" &&
    item.to !== "/about" &&
    item.to !== "/health",
).map(({ to, label }) => ({ to, label }));

export function TopNav({ onMenu, onSearch }: { onMenu: () => void; onSearch?: () => void }) {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <button
            onClick={onMenu}
            aria-label="Open navigation menu"
            className="-ml-2 flex h-11 w-11 items-center justify-center transition hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="shrink-0 font-display text-xl leading-none">
            Lumière<span className="text-primary">.</span>
          </Link>

          <span className="hidden h-4 w-px bg-foreground/15 xl:block" />

          <nav className="hidden items-center gap-5 xl:flex">
            {topLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-[13px] font-medium uppercase tracking-[0.08em] text-foreground/65 transition hover:text-foreground"
                activeProps={{ className: "text-primary" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Publication date — quiet, confident, IMDb-like. */}
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:inline">
            {todayLabel()}
          </span>

          <button
            type="button"
            onClick={onSearch}
            aria-label="Search films"
            className="flex h-10 items-center gap-2 border border-foreground/20 px-3 text-sm text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden truncate md:inline">Search</span>
          </button>

          <button
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center text-foreground/60 transition hover:text-foreground"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
