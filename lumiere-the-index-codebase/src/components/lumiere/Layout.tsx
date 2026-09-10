import { useState, type ReactNode } from "react";
import { TopNav, MobileMenu } from "./TopNav";
import { SearchModal } from "./SearchModal";
import { Footer } from "./Footer";

export function Layout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const openSearch = () => {
    setMenuOpen(false);
    setSearchOpen(true);
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <TopNav onMenu={() => setMenuOpen(true)} onSearch={openSearch} />
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onSearch={openSearch} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
