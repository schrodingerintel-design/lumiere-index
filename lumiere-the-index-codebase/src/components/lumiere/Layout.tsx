import { Toaster } from "sonner";
import { useState, type ReactNode } from "react";
import { TopNav, MobileMenu } from "./TopNav";
import { SearchModal } from "./SearchModal";
import { Footer } from "./Footer";
import { BetaNotice } from "./BetaNotice";

export function Layout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const openSearch = () => {
    setMenuOpen(false);
    setSearchOpen(true);
  };

  return (
    <div className="lumiere-app relative flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <TopNav onMenu={() => setMenuOpen(true)} onSearch={openSearch} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <Toaster theme="dark" richColors />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onSearch={openSearch} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      {/* Beta intro / version-upgrade popup — self-gating, shows once per version. */}
      <BetaNotice />
    </div>
  );
}
