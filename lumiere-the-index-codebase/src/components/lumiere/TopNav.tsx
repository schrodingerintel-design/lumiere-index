import { useLibrary } from "@/lib/library";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Bookmark, Compass, Menu, Search, TrendingUp, X } from "lucide-react";
import { Brand, BrandLink } from "./Brand";
import { useWatchlist } from "@/lib/watchlist";

const PRIMARY_LINKS = [
  { to: "/", label: "Discover", exact: true },
  { to: "/movies", label: "Films", exact: false },
  { to: "/series", label: "TV", exact: false },
  { to: "/people", label: "People", exact: false },
  { to: "/explore", label: "Explore", exact: false },
] as const;
const CHART_LINKS = [
  { to: "/games", label: "Games" },
  { to: "/creators", label: "Creators" },
  { to: "/music", label: "Music" },
  { to: "/genres", label: "Film genres" },
  { to: "/trending", label: "Index trends" },
  { to: "/top-100", label: "Movie 100" },
  { to: "/tv-100", label: "TV 100" },
  { to: "/rising", label: "Biggest movers" },
  { to: "/new-entries", label: "New entries" },
  { to: "/calendar", label: "Now & next" },
  { to: "/compare", label: "Compare titles" },
  { to: "/about", label: "About The Index" },
] as const;

export function TopNav({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { slugs } = useWatchlist();
  const { items } = useLibrary();
  const savedCount = slugs.length + items.length;
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
              aria-label="Search titles and people"
            >
              <Search size={17} />
              <span>Search culture</span>
            </button>
            <Link to="/library" className="nav-watchlist">
              <Bookmark size={17} />
              <span>Saved</span>
              {savedCount > 0 && <small>{savedCount}</small>}
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
        <Link to="/explore" activeProps={{ className: "nav-active" }}>
          <TrendingUp size={20} />
          Explore
        </Link>
        <button onClick={onSearch}>
          <Search size={20} />
          Search
        </button>
        <Link to="/library" activeProps={{ className: "nav-active" }}>
          <Bookmark size={20} />
          Saved
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
          <Dialog.Title className="mt-8 text-2xl">Find your corner of culture.</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Film, TV, people, games, creators, and music.
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
