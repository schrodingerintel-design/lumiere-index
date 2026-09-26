# The Index — Advertising Architecture

Google AdSense, wired into the site's own placement system.

> **Current state: advertising is ACTIVE and consent-gated.** The publisher id
> is configured, but the AdSense library still loads only after a real consent
> decision: a visitor who declines gets no Google script, no ad request, and no
> reserved space. Auto Ads remain OFF — The Index controls its own placements.

## RANKING INDEPENDENCE (architectural guarantee)

Advertising is a **presentation-layer** concern and has **absolutely no
connection to the ranking engine**. Advertisers cannot influence:

- Index Score / TVDex Score
- chart position or rank numbering
- movement indicators
- Movie 100 / TV 100 eligibility
- Biggest Movers, New Entries, Weekly Index, All-Time records

Enforced by construction:

- `src/lib/ads/*` imports nothing from ranking, scoring, or API data layers.
- The ranking engine (`backend/app/services/ranking.py`) imports nothing from
  any ad module and has no knowledge placements exist.
- Ranks and scores rendered next to an ad slot come exclusively from the
  backend ranking pipeline, fed by measured cultural signals only.
- An `AdSlot` renders **no rank number, no score, no movement arrow, no
  poster, and no title typography** — an advertisement can never be visually
  confused with a ranked title.
- Ad rows in charts are render-order separators only; ranks come from the API
  and are unaffected by what sits between rows.

## Module map

| File | Role |
| --- | --- |
| `config.ts` | Global switches (`ADS_ENABLED`), placement registry, formats |
| `consent.ts` | Consent-state resolution (TCF v2.2 → Consent Mode v2 → local flag) |
| `adsense.ts` | The ONLY code that touches Google scripts; gated loader |
| `../../components/lumiere/AdSlot.tsx` | The single reusable ad surface |
| `../../components/lumiere/AdConsentBanner.tsx` | First-party consent banner + footer reset control |

## Configuration

Build-time environment variables (Vite — set in the host environment, never
committed):

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_ADS_ENABLED` | `false` | Master switch. Anything else = ads fully off. |
| `VITE_ADSENSE_CLIENT` | — | AdSense publisher id (`ca-pub-…`) |
| `VITE_ADS_AUTO` | `false` | Google Auto Ads. **Off by default** — The Index controls its own placements so ads can never appear in navigation, the hero, or between critical ranking info. |
| `VITE_ADS_CONSENT_REQUIRED` | `true` | Set `false` only where consent is not legally required. |
| `VITE_SHOW_AD_SLOTS` | `false` | Dev slot preview boxes. **Ignored in production builds** (hard `import.meta.env.PROD` gate). |

With ads disabled there are **zero ad containers in the DOM** — pages render
byte-identically to a build without the ad system. With ads enabled but
consent unresolved or denied, the containers collapse to **no reserved
height**, so a declined visitor sees no dead space either.

## Placement registry

| Placement id | Location | Notes |
| --- | --- | --- |
| `home-after-top10` | Home · after Movie 100 Top 10 | Never inside hero / Top 10 / under #1 |
| `home-secondary` | Home · between PulseRow and genre exploration | Far down the page |
| `top100-after-20` | Movie 100 · after rank #20 | Non-ranked separator row |
| `top100-after-50` | Movie 100 · after rank #50 | Non-ranked separator row |
| `tv100-after-10` | TV 100 · after rank #10 | Non-ranked separator row |
| `tv100-after-30` | TV 100 · after rank #30 | Non-ranked separator row |
| `genre-inline` | Genre shelf · between content groups | One slot max; deliberate low frequency |
| `title-secondary` | Title page · after all primary info, before More Like This | Never over backdrop/score/posters/trailer |

**Search: intentionally no placement.** The registry supports a future id
without code changes, but by product decision Search stays ad-free for now.

Placement ids double as per-location analytics keys for future measurement —
each `<AdSlot>` renders `data-ad-slot="<id>"`. No user tracking is implemented.

## Behaviour contract (AdSlot)

- Ads disabled / placement disabled / unknown id → **renders `null`**. No
  wrapper, no min-height, no reserved space.
- Dev slot preview enabled (dev builds) → subtle `AD SLOT · <id>` box.
- Ads enabled + lazy slot approaching viewport (600 px rootMargin) → quiet
  reserved region (100 px mobile / 120 px desktop min-height) with the
  required "Advertisement" labelling; the `ins.adsbygoogle` element is
  populated by the library.
- Ad unavailable or slow → the region stays quiet; nothing breaks, nothing
  overlaps, nothing covers content.

## Mobile & performance

- Mobile units are fluid (`data-ad-format="auto"`, full-width responsive) —
  never a shrunken desktop unit. Page padding is preserved; horizontal
  scrolling is impossible (widths are percentage-based, not fixed).
- Every placement is lazy via IntersectionObserver; the AdSense library is
  injected **only** when an enabled slot approaches the viewport **and** ads
  are enabled **and** consent is granted. On today's site that code path never
  executes.
- Reservation heights only exist while an ad can actually load → no giant
  blank voids while disabled, minimal CLS when enabled.
- No scripts are added to the server render path; SSR never loads ads.

## Consent architecture

No fake consent is implemented and nothing auto-grants. Resolution order in
`consent.ts`:

1. IAB TCF v2.2 CMP (`window.__tcfapi`) — Google's recommended integration.
2. Google Consent Mode v2 signals (`ad_storage`) on the dataLayer.
3. First-party flag `localStorage["index.ads.consent"]`, written by
   `AdConsentBanner` via `setLocalConsent()`.
4. Otherwise `"unknown"` → **scripts stay blocked**.

`AdConsentBanner` is mounted once in the root shell and renders only while the
decision is genuinely undecided (never during SSR, so there is no hydration
mismatch). Consent is **observable**, not merely readable: `setLocalConsent`
and `clearLocalConsent` notify `subscribeConsent` subscribers, so a slot that
first rendered while consent was `"unknown"` opens the moment the visitor
accepts. The footer's **Ad choices** control clears the decision and re-opens
the banner, so withdrawing consent is as easy as granting it.

Non-personalized decisions (serving non-personalized ads where consent is
limited) can plug into the same gate before any script loads.

## Activation status

1. AdSense approval + publisher id — **done** (`ca-pub-4820978382535849`).
2. `VITE_ADS_ENABLED=true` + `VITE_ADSENSE_CLIENT` — **done** in `.env.local`;
   set the same two vars in the **Vercel** production environment.
3. Per-placement kill-switches — available via `enabled: false` in `PLACEMENTS`.
4. Consent mechanism — **done**: first-party `AdConsentBanner`.
5. `ads.txt` at the domain root — **done** (`public/ads.txt`).
6. Visible "Advertisement" label on every filled slot — **done**.
7. `VITE_ADS_AUTO` — deliberately **off**; leave unset.
8. After any change here, re-run `npx vitest run src/__tests__/ads.test.ts`.
