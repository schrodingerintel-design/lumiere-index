import { Link } from "@tanstack/react-router";
import { Film, Search } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-foreground/5 bg-background/80 px-4 lg:px-6 backdrop-blur">
      <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
        <Film className="h-5 w-5" />
        <span>Lumière</span>
      </Link>

      <div className="hidden md:flex flex-1 items-center gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search films..."
            className="w-full rounded-full border border-foreground/10 bg-background/40 py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur focus:border-primary/40 focus:outline-none"
          />
        </div>

        <ThemeToggle />
      </div>

      <div className="md:hidden flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  );
}
