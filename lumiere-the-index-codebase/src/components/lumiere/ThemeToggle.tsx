import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("lumiere-theme") : null;
    const prefersLight = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
    const current: "light" | "dark" = (stored === "light" || stored === "dark" ? stored : prefersLight ? "light" : "dark");
    applyTheme(current);
  }, []);

  const applyTheme = (value: "light" | "dark") => {
    document.body.classList.toggle("light", value === "light");
    window.localStorage.setItem("lumiere-theme", value);
  };

  const toggle = () => {
    const next = document.body.classList.contains("light") ? "dark" : "light";
    applyTheme(next);
    btnRef.current?.focus();
  };

  if (!mounted) {
    return (
      <button
        type="button"
        ref={btnRef}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground transition hover:text-foreground"
        aria-label="Toggle theme"
      >
        <Moon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      ref={btnRef}
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground transition hover:text-foreground"
      aria-label="Toggle theme"
    >
      {document.body.classList.contains("light") ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
