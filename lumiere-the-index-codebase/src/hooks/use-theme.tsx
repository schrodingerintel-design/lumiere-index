import { useEffect } from "react";

// The Index is a dark-only product. This hook exists so legacy call sites keep
// working; it simply pins the document to the dark cinema theme.
export function useTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    root.classList.remove("light");
  }, []);

  return { theme: "dark" as const, toggle: () => {} };
}
