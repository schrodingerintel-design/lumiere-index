import { useState, type ReactNode } from "react";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { SearchModal } from "./SearchModal";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function Layout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <div className="relative min-h-screen">
      <div className="grain-overlay" aria-hidden />
      <Sidebar />
      <MobileSidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSearch={() => setSearchOpen(true)}
      />
      <div className="lg:pl-72">
        <Header />
        <TopNav onMenu={() => setMenuOpen(true)} onSearch={() => setSearchOpen(true)} />
        <main className="pb-12">{children}</main>
        <Footer />
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
