import { Link } from "@tanstack/react-router";
import { CalendarDays, Search, Sparkles, Tags, TrendingUp } from "lucide-react";
import { useOpenSearch } from "@/components/lumiere/search-context";

/**
 * The product's secondary charts, as a chip row. Every chip is an existing
 * route — nothing here is a new destination or an invented feature.
 */
const CHIPS = [
  { to: "/new-entries", label: "New Entries", Icon: Sparkles },
  { to: "/trending", label: "Trending", Icon: TrendingUp },
  { to: "/genres", label: "Genres", Icon: Tags },
  { to: "/calendar", label: "Now & Next", Icon: CalendarDays },
] as const;

export function HomeDestinationChips() {
  const openSearch = useOpenSearch();

  return (
    <nav className="ix-chips" aria-label="More charts">
      {CHIPS.map(({ to, label, Icon }) => (
        <Link key={to} to={to} className="ix-chip">
          <Icon aria-hidden />
          {label}
        </Link>
      ))}
      <button type="button" onClick={openSearch} className="ix-chip">
        <Search aria-hidden />
        Search
      </button>
    </nav>
  );
}
