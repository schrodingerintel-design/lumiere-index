# lumiereindex.com — Domain Launch Runbook

Everything code-side is already wired (canonical URLs, sitemap, robots, OG
image, share links, CORS, legal identity). This runbook covers the steps that
require your Vercel / registrar / Railway / Google dashboards. Do them in
order — SSL and the www redirect only activate after DNS propagates.

## 1. Vercel — add domains, SSL, primary-domain redirect

Frontend project → **Settings → Domains** → add **both**:

- `lumiereindex.com` (apex)
- `www.lumiereindex.com`

Vercel provisions TLS certificates for both automatically. When both are
added, Vercel marks one as primary and **308-redirects the other to it** —
set `lumiereindex.com` as primary, and `www.lumiereindex.com/:path*` 308s to
`https://lumiereindex.com/:path*` automatically. (The `redirects` rule now in
`vercel.json` is a belt-and-braces match for the same behavior.)

## 2. DNS — records to create at your registrar

| Type  | Name | Value                        | Notes                              |
|-------|------|------------------------------|------------------------------------|
| A     | `@`  | `76.76.21.21`                | Vercel apex                        |
| CNAME | `www`| `cname.vercel-dns.com`       | Vercel www                         |

If the registrar doesn't support CNAME flattening on the apex, use ALIAS/ANAME
→ `cname.vercel-dns.com` instead of the A record. TTL 3600 or lower. Propagation
is usually minutes; up to 24h worst case. SSL issuance starts automatically once
the records resolve — nothing else to configure.

## 3. Railway — backend CORS / allowed origins

The backend now allows `https://lumiereindex.com` in code
(`backend/app/main.py`, `allow_origin_regex`). The API is public, read-only and
keyless, so no Railway change is strictly required. If you prefer an explicit
allowlist via environment instead:

- Railway service → **Variables** → set
  `CORS_ORIGINS=https://lumiereindex.com,https://www.lumiereindex.com`
- Redeploy (variables apply on next deploy).

## 4. Auth — callback / redirect URLs

The Index currently has **no accounts** — the watchlist is local-only
(`localStorage`) and there are no OAuth providers, so there are no callback
URLs to update. When auth is added, register
`https://lumiereindex.com/api/auth/callback/*` with the provider at that time.

## 5. Google Search Console — domain property from day one

1. Create a **Domain property** (`lumiereindex.com` — covers http/https/www).
2. Verification method: **DNS TXT** (registrar) or **HTML tag** — for the tag,
   set `VITE_GOOGLE_SITE_VERIFICATION=<token>` (frontend env var) and deploy;
   the tag renders only when the variable is set.
3. Submit `https://lumiereindex.com/sitemap.xml` under **Sitemaps**.
4. From day one: Performance reports segment traffic by query/page/country —
   the longitudinal data compounds, which is what matters for growth decisions
   and fundraising narratives.

## 6. Analytics — same reasoning

`@vercel/analytics` is already installed and renders in the root shell — it
reports against the Vercel project, so switching the primary domain does not
reset it; traffic attribution just follows the new hostname. If you want
Google Analytics as the domain-level archive, create the GA4 property for
`lumiereindex.com` now; earlier data ≠ better dashboards, but uninterrupted
history does.

## 7. Post-launch verification checklist

```bash
curl -sI https://lumiereindex.com            # 200, TLS valid
curl -sI https://www.lumiereindex.com        # 308 → https://lumiereindex.com
curl -s https://lumiereindex.com/robots.txt  # sitemap line present
curl -s https://lumiereindex.com/sitemap.xml # 200 application/xml
curl -s https://lumiereindex.com/ | grep -o 'rel="canonical" href="[^"]*"'
curl -s https://lumiereindex.com/ | grep -o 'og:url" content="[^"]*"'
```

Then in Search Console → URL Inspection → "Request indexing" for `/`,
`/top-100`, `/tv-100`.

## 8. Share cards

The canvas-rendered cards now footer `lumiereindex.com` instead of
`theindex.app`, and the Web Share/copy path rewrites whatever origin the page
is opened from to `https://lumiereindex.com`, so links shared from preview
deployments still land on the canonical domain.

## 9. MySQL crash (2026-09-20) — cause and fix

The Railway MySQL service crash-looped after the image was changed from
`mysql:9.4` (ran fine for 29 days) to `mysql:9`. MySQL has **no downgrade
path**: opening a 9.4 data directory with the 9.0 binaries forces system-table
"upgrades" (`ALTER TABLE user ... ssl_type`, redo-log resize) that exhaust the
InnoDB dictionary (`The table 'columns' is full`) and the server dies at boot.

**Fix (dashboard, one step):** MySQL service → Settings → Image → set
`mysql:9.4` → Restart. The data volume is untouched; the server comes back
with all data.

**Never move a MySQL image to an older minor version.** Upgrade path only:
9.4 → 9.6 etc., with a backup first (Railway: Backups tab).

**Code-side hardening shipped alongside (this repo):**
- Connect/read/write timeouts on the PyMySQL pool — a dead DB now fails in
  ~5s instead of hanging SSR renders for 20–40s
- 4s client timeout on all frontend API calls — the site degrades to
  skeletons + client refetch instead of multi-second TTFB
- Daily data-retention job (`run_retention`): collapses stale ranking
  snapshots to one row per (chart, title, day) + each title's exact first
  appearance + every distinct intraday rank, prunes raw mentions/metrics
  past 30 days and stale pending mentions — published chart numbers are
  preserved bit-exactly (see `tests/test_retention.py`)
- Manual trigger: `POST /api/v1/admin/maintenance/run` (X-Admin-Key)

## 10. Legal pages

Privacy Policy and Terms now identify the service as **Lumière — The Index**
at `lumiereindex.com` with `privacy@lumiereindex.com` contact addresses. The
cookie-controls language already defers to browser settings; revisit only when
advertising (and real consent tooling) is activated — see the dormant ads
system docs for the consent gate that will need wiring then.
