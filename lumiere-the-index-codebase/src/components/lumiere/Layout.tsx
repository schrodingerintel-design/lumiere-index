import { useState, type ReactNode } from "react";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
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
    <div className="relative min-h-screen">
      <div className="grain-overlay" aria-hidden />
      <Sidebar />
      <div className="lg:pl-72">
        <TopNav onMenu={() => setMenuOpen(true)} onSearch={openSearch} />
        <main className="pb-12">{children}</main>
        <Footer />
      </div>
      <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} onSearch={openSearch} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
