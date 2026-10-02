import { useState, useCallback, useMemo, type ReactNode } from "react";
import { TopNav } from "./TopNav";
import { MobileTabBar, SideDrawer } from "./MobileNav";
import { SearchModal } from "./SearchModal";
import { Footer } from "./Footer";
import { BetaNotice } from "./BetaNotice";
import { ChromeContext, type Chrome } from "./chrome-context";

/**
 * The product shell: chrome, page, footer.
 *
 * There is exactly ONE header. Layout renders it by default, as a quiet bar on
 * the site's ink. Home opts out (`header={false}`) because there the header
 * belongs INSIDE the luminous plane, drawn in dark ink on the glass — the same
 * header component in its `panel` tone, not a second bar. Every route therefore
 * opens with the same navigation, placed where that page's composition needs it.
 */
export function Layout({
  children,
  header = true,
}: {
  children: ReactNode;
  /** Home renders the header itself, inside the plane. */
  header?: boolean;
}) {
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

  const chrome = useMemo<Chrome>(
    () => ({ openSearch, openMenu }),
    [openSearch, openMenu],
  );

  return (
    <ChromeContext.Provider value={chrome}>
      <div className="relative flex min-h-screen flex-col">
        {header && <TopNav tone="ink" />}
        <main className="flex-1">{children}</main>
        <Footer />
        <MobileTabBar onSearch={openSearch} />
        <SideDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
        {/* Beta intro / version-upgrade popup — self-gating, shows once per version. */}
        <BetaNotice />
      </div>
    </ChromeContext.Provider>
  );
}
