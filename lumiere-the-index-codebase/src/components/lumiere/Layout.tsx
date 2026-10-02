import { useState, useCallback, type ReactNode } from "react";
import { TopNav } from "./TopNav";
import { MobileTabBar, SideDrawer } from "./MobileNav";
import { SearchModal } from "./SearchModal";
import { Footer } from "./Footer";
import { BetaNotice } from "./BetaNotice";
import { OpenSearchContext } from "./search-context";

export function Layout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const openSearch = useCallback(() => {
    setMenuOpen(false);
    setSearchOpen(true);
  }, []);

  const openMenu = useCallback(() => {
    setSearchOpen(false);
    setMenuOpen(true);
  }, []);

  return (
    <OpenSearchContext.Provider value={openSearch}>
      <div className="relative flex min-h-screen flex-col">
        <TopNav onMenu={openMenu} onSearch={openSearch} />
        <main className="flex-1">{children}</main>
        <Footer />
        <MobileTabBar onSearch={openSearch} />
        <SideDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
        {/* Beta intro / version-upgrade popup — self-gating, shows once per version. */}
        <BetaNotice />
      </div>
    </OpenSearchContext.Provider>
  );
}
