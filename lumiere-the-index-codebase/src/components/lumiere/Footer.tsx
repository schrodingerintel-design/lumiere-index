import { Link } from "@tanstack/react-router";const COMPANY_LINKS = [
  { to: "/about", label: "About" },
  { to: "/methodology", label: "Methodology" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms & Conditions" },
] as const;

const EXPLORE_LINKS = [
  { to: "/top-100", label: "The Top 100" },
  { to: "/rising", label: "Rising Now" },
  { to: "/new-entries", label: "New Entries" },
  { to: "/trending", label: "Trending Topics" },
  { to: "/calendar", label: "Now & Next" },
  { to: "/compare", label: "Compare Films" },
] as const;

export function Footer() {
  return (
    <footer className="mt-16 border-t border-foreground/10 px-4 pb-16 pt-12 lg:px-6">
      {/* Closing statement — what The Index actually measures. Said once, not looped. */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-display text-2xl leading-snug text-foreground sm:text-3xl">
          The Index doesn't ask critics. It measures what audiences are actually
          doing — watching, posting, arguing, and turning films into culture.
        </p>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          0% critic weight · 100% audience signal
        </div>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Link to="/" className="font-display text-2xl leading-none">
            Lumière<span className="text-primary">.</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            The cultural momentum index for cinema. The official Top 100 is refreshed
            daily; Rising Now tracks short-term momentum between snapshots.
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
        <span className="font-mono">0% critic weight · audience-driven · daily official Index</span>
      </div>
    </footer>
  );
}
