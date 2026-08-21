import { Link } from "@tanstack/react-router";
import { Menu, ShieldCheck, Sun, Moon } from "lucide-react";
import { NAV_ITEMS } from "./Sidebar";
import { useTheme } from "@/hooks/use-theme";
import { SearchBox } from "./SearchBox";

const topLinks = NAV_ITEMS.filter(
  (item) =>
    item.to !== "/" &&
    item.to !== "/new-entries" &&
    item.to !== "/genres" &&
    item.to !== "/calendar",
).map(({ to, label }) => ({ to, label }));

export function TopNav({ onMenu, onSearch }: { onMenu: () => void; onSearch?: () => void }) {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-30 px-4 pt-4 lg:px-6">
      <div className="glass mx-auto flex h-14 items-center justify-between rounded-full px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button onClick={onMenu} className="rounded-md p-1.5 hover:bg-foreground/5 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="font-serif text-lg lg:hidden">
            Lumière<span className="text-primary">.</span>
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
            {topLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-xs uppercase tracking-wider text-foreground/70 transition hover:text-foreground"
                activeProps={{ className: "text-primary font-medium" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <SearchBox className="mx-2 hidden w-40 md:flex xl:w-56" onOpen={onSearch} />

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="rounded-full p-2 text-foreground/60 transition hover:bg-foreground/5 hover:text-foreground"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Real-Time Audience Index Badge */}
          <div
            title="Signal engine ramping up — rankings derived from 86,000+ audience signals across Reddit, Letterboxd, news & social channels. Live ingestion is active; data volume grows with each sync cycle."
            className="hidden xl:flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary font-mono transition-all hover:bg-primary/20 cursor-help"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Audience Signal Engine</span>
          </div>
        </div>
      </div>
    </header>
  );
}
