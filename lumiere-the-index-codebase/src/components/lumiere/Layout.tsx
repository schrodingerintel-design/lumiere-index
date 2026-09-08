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
      {/* Live blur — ambient violet light drifting behind everything. Pure
          atmosphere: fixed, pointer-transparent, behind all content (z-0). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ambient-orb orb-violet left-[-10%] top-[-15%] h-[55vmax] w-[55vmax]" />
        <div className="ambient-orb orb-violet-deep right-[-15%] top-[30%] h-[50vmax] w-[50vmax]" />
        <div className="ambient-orb orb-magenta bottom-[-20%] left-[20%] h-[45vmax] w-[45vmax]" />
      </div>
      <Sidebar />
      <div className="relative z-10 lg:pl-64">
        <TopNav onMenu={() => setMenuOpen(true)} onSearch={openSearch} />
        <main className="pb-12">{children}</main>
        <Footer />
      </div>
      <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} onSearch={openSearch} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
