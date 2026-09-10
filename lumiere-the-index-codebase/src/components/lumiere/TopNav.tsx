import { Link } from "@tanstack/react-router";
import { Menu, Search } from "lucide-react";

/**
 * Primary navigation — the product surface. Secondary destinations
 * (Watchlist, Compare, About) live in the footer and mobile menu.
 */
const PRIMARY_LINKS = [
  { to: "/", label: "The Index", exact: true },
  { to: "/hot-50", label: "Hot 50", exact: false },
  { to: "/rising", label: "Biggest Movers", exact: false },
  { to: "/new-entries", label: "New Entries", exact: false },
  { to: "/trending", label: "Trending", exact: false },
  { to: "/genres", label: "Genres", exact: false },
] as const;

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function TopNav({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-ink/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          {/* Mobile: compact Apple-style header — logo + menu + search */}
          <button
            onClick={onMenu}
            aria-label="Open navigation menu"
            className="-ml-1.5 flex h-10 w-10 items-center justify-center text-foreground/80 transition hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="shrink-0 font-display text-xl leading-none tracking-tight">
            Lumière<span className="text-primary">.</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
            {PRIMARY_LINKS.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                activeOptions={{ exact: l.exact ?? false }}
                activeProps={{ className: "text-foreground" }}
                className="text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground xl:inline">
            {todayLabel()}
          </span>
          <button
            type="button"
            onClick={onSearch}
            className="flex h-9 items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] px-3.5 text-[13px] text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileMenu({
  open,
  onClose,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: () => void;
}) {
  // Mounted only while open — unmounting guarantees no invisible layer traps taps.
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="animate-fade-up absolute inset-x-0 top-0 border-b border-border bg-ink shadow-2xl shadow-black/60">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-display text-xl leading-none">
            Lumière<span className="text-primary">.</span>
          </span>
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-10 w-10 items-center justify-center text-foreground/80 transition hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col px-4 pb-6" aria-label="Mobile">
          {PRIMARY_LINKS.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              onClick={onClose}
              activeOptions={{ exact: l.exact ?? false }}
              activeProps={{ className: "text-foreground" }}
              className="flex min-h-12 items-center border-b border-foreground/5 text-[15px] text-muted-foreground transition last:border-0 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/watchlist"
            onClick={onClose}
            className="flex min-h-12 items-center border-b border-foreground/5 text-[15px] text-muted-foreground transition hover:text-foreground"
          >
            Watchlist
          </Link>
          <Link
            to="/compare"
            onClick={onClose}
            className="flex min-h-12 items-center border-b border-foreground/5 text-[15px] text-muted-foreground transition hover:text-foreground"
          >
            Compare
          </Link>
          <Link
            to="/about"
            onClick={onClose}
            className="flex min-h-12 items-center text-[15px] text-muted-foreground transition hover:text-foreground"
          >
            About
          </Link>
        </nav>
      </div>
    </div>
  );
}
