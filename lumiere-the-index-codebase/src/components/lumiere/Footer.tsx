import { Link } from "@tanstack/react-router";
import { BrandLink } from "@/components/lumiere/Brand";

const COMPANY_LINKS = [
  { to: "/about", label: "About" },
  { to: "/methodology", label: "Methodology" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
] as const;

const EXPLORE_LINKS = [
  { to: "/", label: "The Index" },
  { to: "/hot-50", label: "Hot 50" },
  { to: "/rising", label: "Biggest Movers" },
  { to: "/new-entries", label: "New Entries" },
  { to: "/trending", label: "Trending" },
  { to: "/genres", label: "Genres" },
  { to: "/calendar", label: "Now & Next" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border px-4 pb-10 pt-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <BrandLink />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The cultural index for film and television — published daily.
            </p>
          </div>

          <nav aria-label="Explore">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Explore
            </div>
            <ul className="mt-4 space-y-2.5 text-sm">
              {EXPLORE_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-foreground/70 transition hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Company
            </div>
            <ul className="mt-4 space-y-2.5 text-sm">
              {COMPANY_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-foreground/70 transition hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} The Index — by Lumière. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
