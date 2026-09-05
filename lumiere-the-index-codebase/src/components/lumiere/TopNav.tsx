import { Link } from "@tanstack/react-router";
import { Menu, ShieldCheck, Sun, Moon } from "lucide-react";
import { NAV_ITEMS } from "./Sidebar";
import { useTheme } from "@/hooks/use-theme";
import { SearchBox } from "./SearchBox";

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
      <div className="glass mx-auto flex h-12 items-center justify-between rounded-full px-3 lg:px-5">
        <div className="flex items-center gap-2">
          <button onClick={onMenu} className="rounded-md p-1.5 hover:bg-foreground/5 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="font-serif text-lg lg:hidden">
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

        <SearchBox className="mx-2 hidden w-36 md:flex xl:w-48" onOpen={onSearch} />

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="rounded-full p-1.5 text-foreground/60 transition hover:bg-foreground/5 hover:text-foreground"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Real-Time Audience Index Badge */}
          <div
            title="Signal engine ramping up — rankings derived from 86,000+ audience signals across Reddit, Letterboxd, news & social channels. Live ingestion is active; data volume grows with each sync cycle."
            className="hidden xl:flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] text-primary font-mono transition-all hover:bg-primary/20 cursor-help"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Audience Signal Engine</span>
          </div>
        </div>
      </div>
    </header>
  );
}
