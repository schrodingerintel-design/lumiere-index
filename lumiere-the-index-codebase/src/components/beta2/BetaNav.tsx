/**
 * Beta 2.0 — global navigation.
 *
 * §4 asks for a simplified primary surface: Home, Movies, TV, Weekly, Search.
 * Everything analytical (methodology, records, calendar, compare) is secondary
 * and lives in the footer, which already carries it. No URL changes — the
 * primary links point at the exact routes the product has always used.
 *
 * Mobile is designed, not collapsed (§11). Rather than hiding the same desktop
 * bar behind a hamburger, mobile gets a real bottom tab bar: the five things a
 * visitor does on a phone, always reachable with a thumb, with a safe-area
 * inset so it never sits under a home indicator.
 *
 * The desktop bar keeps the date/chart-cadence context because there is room
 * for it, and drops it entirely on narrow viewports where it was noise.
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Home, Search, Sparkles, Tv } from "lucide-react";

import { cn } from "@/lib/utils";

/** The five primary destinations. Paths are unchanged from 1.x. */
const PRIMARY = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/top-100", label: "Movies", icon: Sparkles, exact: false },
  { to: "/tv-100", label: "TV", icon: Tv, exact: false },
  { to: "/weekly-100", label: "Weekly", icon: CalendarDays, exact: false },
] as const;

function todayLabel(): string {
  try {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** The Index wordmark + violet mark. */
function BrandLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-b2-sm bg-violet text-[13px] font-black text-paper"
        aria-hidden
      >
        I
      </span>
      <span className="text-[15px] font-bold tracking-[-0.02em] text-paper">The Index</span>
    </span>
  );
}

export function BetaNav({ onSearch }: { onSearch: () => void }) {
  // Rendered on the server too, so hydration must not depend on the clock.
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    setDate(todayLabel());
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[#070708]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-canvas items-center gap-6 px-5 sm:px-8 lg:px-14">
        <Link
          to="/"
          className="focus-ring -ml-1 flex min-h-11 items-center rounded-b2-sm px-1"
          aria-label="The Index — home"
        >
          <BrandLockup />
        </Link>

        {/* Desktop primary nav. Violet marks the selected destination. */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {PRIMARY.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{
                className: "bg-violet/12 text-paper",
              }}
              className="focus-ring rounded-b2-sm px-3.5 py-2 text-[14px] font-medium text-[#A8A6A1] transition-colors hover:bg-surface-2 hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {date ? (
            <span className="hidden text-[13px] text-[#7C7A76] lg:inline">{date}</span>
          ) : null}
          <button
            type="button"
            onClick={onSearch}
            className="focus-ring hidden min-h-10 items-center gap-2 rounded-b2-sm border border-line bg-surface-1 px-3.5 text-[13px] font-medium text-[#A8A6A1] transition-colors hover:border-violet/40 hover:text-paper sm:inline-flex"
          >
            <Search className="h-4 w-4" aria-hidden />
            Search culture
          </button>
          {/* Mobile keeps search in the bottom bar, so the header stays quiet. */}
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search culture"
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-b2-sm text-[#A8A6A1] transition-colors hover:text-paper sm:hidden"
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * Mobile bottom tab bar. Fixed, thumb-reachable, safe-area aware.
 * Rendered only below `md` so the desktop header is never duplicated.
 */
export function MobileTabBar({ onSearch }: { onSearch: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[#070708]/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {PRIMARY.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "text-violet-hi" }}
              className="focus-ring flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[11px] font-medium text-[#7C7A76] transition-colors"
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <item.icon
                    className={cn("h-5 w-5", isActive && "text-violet-hi")}
                    aria-hidden
                    strokeWidth={isActive ? 2.4 : 1.9}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onSearch}
            className="focus-ring flex min-h-[3.75rem] w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-[#7C7A76] transition-colors"
          >
            <Search className="h-5 w-5" aria-hidden strokeWidth={1.9} />
            <span>Search</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
