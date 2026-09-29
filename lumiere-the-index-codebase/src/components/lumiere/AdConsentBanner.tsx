/**
 * The Index — Ad Consent Banner
 * ═══════════════════════════════
 * The first-party consent surface the ad architecture was built to accept.
 *
 * `consent.ts` resolves state in this order: TCF v2.2 CMP → Google Consent
 * Mode v2 → this banner's local flag. Nothing auto-grants, so with no CMP
 * installed the AdSense library stays blocked forever. This component is the
 * missing link: it records a real decision via `setLocalConsent()`, which both
 * unblocks the gated loader and notifies every subscriber (AdSlot) through
 * `subscribeConsent`.
 *
 * Design constraints, held to the same standard as the rest of the site:
 * near-black surface, hairline borders, mono metadata, serif display voice,
 * sparse red emphasis. It is a quiet editorial notice, not a modal lightbox,
 * and it never covers the hero or any ranked title.
 *
 * Ranking independence is unchanged: nothing here reads or writes chart data.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ADS_ENABLED } from "@/lib/ads/config";
import { clearLocalConsent, getConsentState, setLocalConsent } from "@/lib/ads/consent";

/**
 * Renders only while consent is genuinely undecided. The check runs on the
 * client after mount: SSR has no localStorage, so rendering during the server
 * pass would guarantee a hydration mismatch on every page.
 */
export function AdConsentBanner() {
  const [decision, setDecision] = useState<"pending" | "asked">("pending");

  useEffect(() => {
    // Ads off → nothing to consent to. Already decided → stay out of the way.
    if (!ADS_ENABLED) return;
    setDecision(getConsentState() === "unknown" ? "asked" : "pending");
  }, []);

  if (decision !== "asked") return null;

  const decide = (choice: "granted" | "denied") => {
    setLocalConsent(choice);
    setDecision("pending");
  };

  return (
    <div
      role="region"
      aria-label="Advertising consent"
      data-ad-consent="banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-foreground/15 bg-background/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Advertising
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">
            The Index carries advertising to stay free. Accepting allows
            third-party vendors, including Google, to use cookies to serve ads
            based on your visits. Declining keeps the same charts with no
            personalized ads.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Advertisers have no influence on any Index Score, rank, or chart
            position.{" "}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => decide("denied")}
            data-ad-consent-choice="denied"
            className="inline-flex h-10 items-center justify-center border border-foreground/20 px-5 text-sm font-medium text-foreground/80 transition hover:border-foreground/40 hover:text-foreground"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            data-ad-consent-choice="granted"
            className="inline-flex h-10 items-center justify-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Footer control that re-opens the banner so a visitor can change a decision
 * later. Withdrawing consent has to be as easy as granting it.
 */
export function AdConsentSettings() {
  if (!ADS_ENABLED) return null;
  return (
    <button
      type="button"
      onClick={() => {
        clearLocalConsent();
        // The banner resolves consent on mount, so a reload is the simplest
        // honest way to re-open it for the current decision.
        window.location.reload();
      }}
      data-ad-consent="reset"
      className="text-foreground/70 underline underline-offset-2 transition hover:text-foreground"
    >
      Ad choices
    </button>
  );
}
