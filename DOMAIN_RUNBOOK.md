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

## 5. Signal source keys — Railway backend variables

Signal Health (`/meta/sources`) shows which collectors are live. As of the
observation-volume score fix, three sources need API keys set as **Railway
backend service Variables** (the sandbox `.env` files do not deploy):

| Variable | Where to get it | Effect when set |
|---|---|---|
| `NEWSAPI_KEY` | newsapi.org (free dev tier) | News collector starts producing mentions (runs every 15 min) |
| `YOUTUBE_API_KEY` | Google Cloud console → YouTube Data API v3 | Trailer view-velocity folds into attention + engagement (runs every 30 min) |
| `REDDIT_OAUTH_*` | reddit.com/prefs/apps | Optional; Reddit is policy-disabled until an OAuth app is registered |

After adding variables, redeploy the backend service and confirm on
`/api/v1/meta/sources` that `key_configured` flips to `true` and counters
start moving. Letterboxd now reports honest per-run health there too (films
walked vs feeds resolved), so a silently-broken collector is visible instead
of a green zero.

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

**Fix (dashboard, in order):**

1. **Backups tab → snapshot the volume first.** The failed `mysql:9` boots
   started modifying system tables (`ALTER TABLE user …`) — the datadir may
   be fragile, so have a restore point before touching the image again.
2. **Check volume disk usage (Metrics).** The log's `The table 'columns' is
   full` (error 1114) typically means the InnoDB system tablespace or the
   volume itself is full — months of unbounded snapshot growth can fill a
   small Railway volume. If it's near capacity, expand the volume (volumes
   grow, they don't shrink) before any version change.
3. **Recover on `mysql:9.4`** (the version the datadir was built with —
   most likely clean boot) → Restart → verify `/readyz` reports `db: ok`.
4. **Then optionally move forward to `mysql:9.7.2`** (current release as of
   2026-09): same Settings → Image change. Upgrading is the supported
   direction and MySQL auto-upgrades system tables on first boot — watch
   the Deploy logs. If the version jump is refused, the bulletproof path is
   `mysqldump` from the recovered 9.4 volume → fresh 9.7.2 volume → import
   (works across any gap and yields a clean, compact datadir).

**Post-mortem correction (2026-09-20, later):** the "volume full" theory was
**wrong** — Railway's Disk usage metric showed `mysql-volume` flat at ~380 MB,
nowhere near capacity. The actual failure signature was the API erroring with
`(2003, "Can't connect to MySQL server on 'mysql.railway.internal' (timed out)")`
in a loop so loud it hit Railway's 500-logs/sec cap and **dropped 1,722 log
messages**. That means: the MySQL container was up but mysqld inside it was
not accepting TCP connections (still finishing crash recovery from the
damaged 9.4→9→9.7.2 boots, or wedged). The fix sequence stays the same; the
disk check is just a sanity step, not the likely cause. If a healthy 9.4
image still won't accept connections after ~5 minutes, use **Backups →
restore the latest snapshot** (or the Backups tab's suggested point) — that
is exactly what the pre-change snapshot in step 1 is for.

**Final diagnosis (2026-09-20, from the MySQL container's own Deploy Logs):**
two decisive errors settled it:
1. `[MY-013360] Invalid MySQL server downgrade: Cannot downgrade from 90702
   to 90400` — the `mysql:9.7.2` attempt upgraded the data dictionary to
   9.7 before dying. **The datadir can never boot on 9.4 again**; the only
   forward path on existing data is `mysql:9.7.x`.
2. `[MY-012634] Error number 28 means 'No space left on device'` — the
   volume's capacity was effectively exhausted (the 379.85 MB Railway
   metric is *used* space; MySQL couldn't write even 1 MB of redo log).
   The 9.7 upgrade artifacts plus unbounded snapshot history filled it —
   the growth the retention job now prevents.

**Recovery ladder (dashboard, in order):**
1. **Expand the volume first** (MySQL → Volumes → ≥ 2 GB). Nothing boots on
   a full volume; this fixes error 28.
2. **Image → `mysql:9.7.2`** (not 9.4 — see the downgrade gate above).
   With space available the interrupted 9.7 upgrade completes on boot.
3. Verify `ready for connections` in Deploy Logs and `/readyz` → `db: ok`.
4. If boot shows corruption instead: **Backups → restore the pre-churn
   snapshot** → boot that datadir on `mysql:9.4` (a pre-9.7 snapshot is a
   9.4 datadir) → verify → only then upgrade to 9.7.2.

**Never move a MySQL image to an older version than the datadir.** Upgrades
only, with a backup first (Railway: Backups tab) — and treat an interrupted
upgrade as a one-way door: the datadir belongs to the newer version after it.

**Code-side hardening shipped alongside (this repo):**
- **DB outage circuit breaker** (`app/services/db_health.py`): the first
  failed connection opens it; every further request gets an instant honest
  503 (`Retry-After: 30`) instead of hanging ~5s on the TCP timeout each.
  Auto half-opens after 30s so one request can probe; the moment MySQL
  answers, the breaker closes and traffic resumes with no redeploy.
  Health probes (`/health`, `/healthz`, `/readyz`) are exempt — a 503
  liveness probe would get the healthy container restarted.
- **Throttled failure logging** (`log_throttled` in logging_config): an
  outage now logs once a minute per endpoint instead of 500+/sec (which
  got messages dropped by Railway's cap).
- **Scheduler outage guard**: ingest/ranking tasks skip quietly while the
  breaker is open instead of failing with a traceback every 15 min.
- Connect/read/write timeouts on the PyMySQL pool — a dead DB fails in
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
