import { Link } from "@tanstack/react-router";
const links = [
  { to: "/movies", label: "Films" },
  { to: "/series", label: "TV" },
  { to: "/people", label: "People" },
  { to: "/games", label: "Games" },
  { to: "/creators", label: "Creators" },
  { to: "/music", label: "Music" },
  { to: "/top-100", label: "The charts" },
] as const;
export function CultureNav() {
  return (
    <nav className="culture-nav no-scrollbar" aria-label="Culture categories">
      {links.map((link) => (
        <Link key={link.to} to={link.to} activeProps={{ className: "culture-nav-active" }}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
