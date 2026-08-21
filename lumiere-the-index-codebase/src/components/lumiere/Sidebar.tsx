import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home,
  Flame,
  Sparkles,
  Hash,
  Globe2,
  Film,
  Calendar,
  Trophy,
  Scale,
  Info,
  X,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { subscribeNewsletter } from "@/lib/apiClient";
import { SearchBox } from "./SearchBox";

export const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/top-100", label: "Top 100", icon: Trophy },
  { to: "/rising", label: "Rising", icon: Flame },
  { to: "/new-entries", label: "New Entries", icon: Sparkles },
  { to: "/trending", label: "Trending Topics", icon: Hash },
  { to: "/genres", label: "By Genre", icon: Film },
  { to: "/calendar", label: "Now & Next", icon: Calendar },
  { to: "/compare", label: "Compare Films", icon: Scale },
  { to: "/about", label: "About Index", icon: Info },
] as const;

export function SidebarContent({
  onNavigate,
  onSearch,
}: {
  onNavigate?: () => void;
  onSearch?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const subscribe = useMutation({
    mutationFn: subscribeNewsletter,
    onSuccess: () => setSubmitted(true),
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    subscribe.mutate(email.trim());
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <Link to="/" onClick={onNavigate} className="block">
        <div className="font-serif text-2xl leading-none">
          Lumière<span className="text-primary">.</span>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          The Index
        </div>
      </Link>

      <SearchBox
        className="md:hidden w-full"
        onOpen={() => {
          onSearch?.();
          onNavigate?.();
        }}
      />

      <nav className="flex flex-col gap-1 overflow-y-auto pr-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: to === "/" }}
            activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
            className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <Icon className="h-4 w-4 opacity-70 group-hover:opacity-100" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-4 pt-2 border-t border-foreground/10">
        <form className="space-y-2" onSubmit={handleSubscribe}>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            The Weekly Dispatch
          </label>
          {submitted ? (
            <p className="text-xs text-forest-deep font-mono">✓ Subscribed to dispatch</p>
          ) : (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full rounded-md border border-foreground/15 bg-background/60 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary transition"
              />
              <button
                type="submit"
                disabled={subscribe.isPending}
                className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {subscribe.isPending ? "Subscribing…" : "Subscribe"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="glass-flat fixed left-4 top-4 bottom-4 z-40 hidden w-64 overflow-hidden rounded-2xl lg:block">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  onSearch?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="glass absolute left-2 top-2 bottom-2 w-72 overflow-hidden rounded-2xl animate-fade-up">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 hover:bg-foreground/10"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent onNavigate={onClose} onSearch={onSearch} />
      </div>
    </div>
  );
}
