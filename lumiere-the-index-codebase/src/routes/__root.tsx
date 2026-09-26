import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SITE_URL, SITE_NAME, sitePath } from "@/lib/site";
import { AdConsentBanner } from "@/components/lumiere/AdConsentBanner";
import { ADSENSE_ACCOUNT_ID } from "@/lib/ads/config";
import { recoverFromStaleDeploy } from "@/lib/staleDeploy";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  // A chunk-load failure here means this tab is running HTML from a previous
  // deployment whose hashed assets no longer exist. One cache-bypassing reload
  // lands the visitor on the current deployment; a session-scoped guard means
  // a second failure renders this boundary instead of looping.
  if (recoverFromStaleDeploy(error)) return null;

  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // Build marker: a deliberately harmless, content-neutral comment whose
      // only purpose is to change the build hash so a deployment can be
      // observed end-to-end. Safe to remove.
      { name: "build-marker", content: "stale-deploy-acceptance-2026-09-26" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "The Index · The titles capturing the most cultural attention" },
      {
        name: "description",
        content:
          "The Index measures what's capturing cultural attention across film and television, refreshed every 15 minutes.",
      },
      { name: "author", content: "Lumière" },
      { property: "og:title", content: "The Index" },
      {
        property: "og:description",
        content: "What's capturing cultural attention in film and television, right now.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      // Canonical identity: every og:image resolves to the production domain,
      // never a deployment URL. og:url + canonical are set PER ROUTE (links
      // are not deduped across routes, so the root must not add them).
      { property: "og:image", content: sitePath("/og-image.png") },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "The Index: live cultural rankings for film and television" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@lumieretheindex" },
      { name: "twitter:creator", content: "@lumieretheindex" },
      { name: "twitter:image", content: sitePath("/og-image.png") },
      // Google Search Console (HTML-tag method): set VITE_GOOGLE_SITE_VERIFICATION
      // to the token from the Search Console verification record; renders only when set.
      ...(import.meta.env.VITE_GOOGLE_SITE_VERIFICATION
        ? [{ name: "google-site-verification", content: import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string }]
        : []),
      // Google AdSense account verification. UNCONDITIONAL on purpose: AdSense
      // rejects verification when this tag is absent, so it must ship in every
      // build regardless of the ad-serving env vars. Served from the static
      // ADSENSE_ACCOUNT_ID, which the test suite pins against ads.txt.
      { name: "google-adsense-account", content: ADSENSE_ACCOUNT_ID },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "The Index",
          alternateName: SITE_NAME,
          url: SITE_URL,
          description:
            "The Index charts cultural momentum across film and television: Movie 100, TV 100, Biggest Movers and New Entries, refreshed every 15 minutes.",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${SITE_URL}/?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* AdSense is loaded lazily by AdSlot — never here — and only once a
            real consent decision exists. The banner is the surface that
            records that decision. */}
        <AdConsentBanner />
        <Scripts />
        <Analytics />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
