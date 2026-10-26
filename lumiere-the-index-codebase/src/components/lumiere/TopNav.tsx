import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Bookmark, Compass, Menu, Search, TrendingUp, X } from "lucide-react";
import { Brand, BrandLink } from "./Brand";
import { useWatchlist } from "@/lib/watchlist";

const PRIMARY_LINKS = [
  { to: "/", label: "Discover", exact: true },
  { to: "/trending", label: "The buzz", exact: false },
  { to: "/top-100", label: "The charts", exact: false },
  { to: "/genres", label: "Explore", exact: false },
] as const;
const CHART_LINKS = [
  { to: "/top-100", label: "Movie 100" },
  { to: "/tv-100", label: "TV 100" },
  { to: "/weekly-100", label: "Weekly 100" },
  { to: "/rising", label: "Biggest movers" },
  { to: "/new-entries", label: "New entries" },
  { to: "/calendar", label: "Now & next" },
  { to: "/compare", label: "Compare titles" },
  { to: "/about", label: "About The Index" },
] as const;

export function TopNav({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { slugs } = useWatchlist();
  return (
    <>
      <header className="social-nav">
        <div className="social-nav-inner">
          <BrandLink />
          <nav className="desktop-links" aria-label="Primary">
            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: link.exact }}
                activeProps={{ className: "nav-active" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <button
              type="button"
              className="nav-search"
              onClick={onSearch}
              aria-label="Search films and shows"
            >
              <Search size={17} />
              <span>Find your next obsession</span>
            </button>
            <Link to="/watchlist" className="nav-watchlist">
              <Bookmark size={17} />
              <span>Watchlist</span>
              {slugs.length > 0 && <small>{slugs.length}</small>}
            </Link>
            <button
              type="button"
              className="nav-menu"
              onClick={onMenu}
              aria-label="Open navigation menu"
            >
              <Menu size={21} />
            </button>
          </div>
        </div>
      </header>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "nav-active" }}>
          <Compass size={20} />
          Discover
        </Link>
        <Link to="/trending" activeProps={{ className: "nav-active" }}>
          <TrendingUp size={20} />
          The buzz
        </Link>
        <button onClick={onSearch}>
          <Search size={20} />
          Search
        </button>
        <Link to="/watchlist" activeProps={{ className: "nav-active" }}>
          <Bookmark size={20} />
          Watchlist
        </Link>
      </nav>
    </>
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
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="navigation-dialog">
          <div className="flex items-center justify-between">
            <Brand />
            <Dialog.Close className="soft-button" aria-label="Close navigation menu">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Title className="mt-8 text-2xl">Find your corner of film culture.</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Discover, explore the charts, and make your next movie plan.
          </Dialog.Description>
          <nav aria-label="All destinations">
            {[...PRIMARY_LINKS, ...CHART_LINKS, { to: "/watchlist", label: "Your watchlist" }].map(
              (link) => (
                <Link key={`${link.to}-${link.label}`} to={link.to} onClick={onClose}>
                  {link.label}
                  <span aria-hidden>↗</span>
                </Link>
              ),
            )}
          </nav>
          <button onClick={onSearch} className="primary-button">
            <Search size={17} /> Search films & TV
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
