import { Link } from "@tanstack/react-router";
import { Film } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex items-center border-b border-foreground/5 bg-background/80 px-4 lg:px-6 backdrop-blur">
      <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
        <Film className="h-5 w-5">
        </Film>
        <span>Lumière</span>
      </Link>
    </header>
  );
}
