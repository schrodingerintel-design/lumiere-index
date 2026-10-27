/**
 * site.ts — the single source of truth for The Index's public identity.
 *
 * Every URL the outside world sees — canonical links, Open Graph URLs,
 * shared links, sitemap entries, share-card footers — must resolve to the
 * canonical production origin below, never a deployment URL (Vercel preview
 * / project domain) or a stale placeholder domain.
 *
 * Deployment URLs (e.g. *.vercel.app) remain reachable for preview builds,
 * but they must never appear in generated links or metadata.
 */
export const SITE_URL = "https://lumiereindex.com";

export const SITE_NAME = "The Index by Lumière";
export const TWITTER_HANDLE = "@lumieretheindex";

/** Absolute URL for a site path, always on the canonical origin. */
export const sitePath = (path: string): string =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Canonical <link> entry for a route. */
export const canonicalLink = (path: string): { rel: string; href: string } => ({
  rel: "canonical",
  href: sitePath(path),
});

/** og:url meta entry for a route. */
export const ogUrlMeta = (path: string): { property: string; content: string } => ({
  property: "og:url",
  content: sitePath(path),
});

/**
 * Build a canonical share URL from any absolute or relative href.
 *
 * Pure (no window): callers pass the current location explicitly, which
 * keeps the function SSR-safe and unit-testable. Preserves the pathname
 * (deep links) + search, but rewrites the origin to the canonical site, so
 * a link shared from a deployment URL (or localhost) still points at
 * lumiereindex.com.
 */
export const canonicalShareUrl = (currentHref: string): string => {
  try {
    const url = new URL(currentHref, SITE_URL);
    return `${SITE_URL}${url.pathname}${url.search}`;
  } catch {
    return SITE_URL;
  }
};

/** Server-rendered social metadata, shared by catalog and chart title pages. */
export function titleSocialMeta(
  title: string,
  description: string,
  path: string,
  image?: string | null,
) {
  const artwork = image && /^https:\/\//.test(image) ? image : sitePath("/og-culture-v2.png");
  return [
    { title: `${title} · Lumière Index` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · Lumière Index` },
    { property: "og:description", content: description },
    { property: "og:url", content: sitePath(path) },
    { property: "og:type", content: "website" },
    { property: "og:image", content: artwork },
    { property: "og:image:alt", content: `${title} · Lumière Index` },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: `${title} · Lumière Index` },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: artwork },
  ];
}
