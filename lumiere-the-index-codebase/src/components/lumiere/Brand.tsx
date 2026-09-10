import { Link } from "@tanstack/react-router";

/**
 * The Index mark — a prism shard. Solid fill inherits `currentColor`
 * so it renders correctly on any surface.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M45 8 L78 62 L45 46 Z" />
      <path d="M43 46 L23 64 L43 86 Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47 46 L78 62 L47 86 Z M47 60 L78 62 L58 52 Z"
      />
    </svg>
  );
}

/**
 * Brand lockup: the product wordmark with the parent brand as a
 * quiet byline. `Lumière` is the brand; `The Index` is the product.
 */
export function Brand({ bylineClassName = "" }: { bylineClassName?: string }) {
  return (
    <span className="flex items-center">
      <LogoMark className="h-[19px] w-[19px] shrink-0 text-foreground" />
      <span className="ml-2 font-display text-xl leading-none tracking-tight">
        The Index<span className="text-primary">.</span>
      </span>
      <span
        className={`ml-2 hidden font-serif text-[11px] italic leading-none text-muted-foreground sm:inline ${bylineClassName}`}
      >
        by Lumière
      </span>
    </span>
  );
}

/** Brand lockup wrapped in a link to the homepage. */
export function BrandLink() {
  return (
    <Link to="/" className="shrink-0 transition-opacity hover:opacity-80" aria-label="The Index — home">
      <Brand />
    </Link>
  );
}
