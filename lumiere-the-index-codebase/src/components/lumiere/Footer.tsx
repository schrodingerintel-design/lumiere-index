import { Link } from "@tanstack/react-router";

const COMPANY_LINKS = [
  { to: "/about", label: "About" },
  { to: "/methodology", label: "Methodology" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms & Conditions" },
] as const;

const EXPLORE_LINKS = [
  { to: "/top-100", label: "Top 100" },
  { to: "/rising", label: "Rising Now" },
  { to: "/new-entries", label: "New Entries" },
  { to: "/trending", label: "Trending Topics" },
  { to: "/calendar", label: "Now & Next" },
  { to: "/compare", label: "Compare Films" },
] as const;

export function Footer() {
  return (
    <footer className="mt-16 border-t border-foreground/10 px-4 pb-16 pt-12 lg:px-6">
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Link to="/" className="font-serif text-2xl leading-none">
            Lumière<span className="text-primary">.</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            The real-time cultural index measuring the films and series the world is watching,
            discussing, and discovering — 0% critic weight.
          </p>
        </div>

        <nav aria-label="Company">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Company
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {COMPANY_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="text-foreground/70 transition hover:text-primary"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Explore">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Explore
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {EXPLORE_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="text-foreground/70 transition hover:text-primary"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-12 flex flex-col gap-2 border-t border-foreground/10 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Lumière — The Index. All rights reserved.</span>
        <span className="font-mono">0% critic weight · audience-driven · refreshed every 15 minutes</span>
      </div>
    </footer>
  );
}
