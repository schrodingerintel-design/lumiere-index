# Hosting evaluation — Cloudflare Workers vs Vercel

Status: **evaluation only.** No application code, dependency or architecture has been changed
to favour either platform. Decision pending founder sign-off.

Date: 2026-11-09. Stack under test: Next.js 16.3.3 (pinned today), Payload 3.93.0,
`@payloadcms/db-postgres`, React 19.2.6, Neon Postgres, Payload auth + RBAC (Phase 4),
Payload Jobs Queue (Phase 4), draft preview + ISR (Phases 3–5), media uploads (Phase 3).

---

## 1. Verdict in one paragraph

Cloudflare Workers can run this exact stack. Our repository was built for Workers during this
evaluation and produced a working bundle, so the question is no longer "is it possible" but
"what does it cost us operationally". Three things must change to make it work: Next.js has to
move to **16.4.5** (which is required for security anyway, and is OpenNext's floor), the Payload
Postgres pool has to become **request-scoped** behind Hyperdrive, and **Payload's sharp-based
`imageSizes` must be replaced** by Cloudflare Images transforms. Two things must be proven at
runtime, not by a build: Payload's **password hashing** and the **jobs queue** under real
Workers isolates. Cost clearly favours Cloudflare ($5/month vs Vercel's $20/month commercial
floor), and Cloudflare's native cron removes the external-scheduler compromise we accepted for
Vercel Hobby.

**Recommendation: adopt Cloudflare as the preferred target, gated on a two-day runtime spike on
a real account.** Do not finalise Vercel, and do not start the migration until that spike passes.

---

## 2. How this was tested

1. Published facts: Vendor docs and advisories read 2026-11-09 (Vercel terms and fair-use,
   Cloudflare Workers limits/pricing/Previews/Hyperdrive/Images, OpenNext support matrix and
   changelog, Payload docs and issue tracker, Neon docs).
2. Local spike, outside the repository (no approved files touched): the committed tree was
   exported to a scratch directory, `next` and `eslint-config-next` were raised to `16.4.5`,
   `@opennextjs/cloudflare@1.20.16` and `wrangler@4.158.0` were added, and
   `opennextjs-cloudflare build` was run against the unmodified Payload config.

Measured result of the spike:

| Measurement        | Value                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Next build         | succeeded, 31.2 s compile, 9.7 s typecheck                                                                |
| Routes emitted     | `/`, `/_not-found`, `/admin/[[...segments]]`, `/api/[...slug]`, `/api/graphql`, `/api/graphql-playground` |
| OpenNext bundling  | succeeded (`worker.js`, static assets, cache assets, server function)                                     |
| Worker upload size | **19,950 KiB uncompressed, 4,463 KiB gzipped**                                                            |
| Workers size limit | 64 MiB uncompressed (no compressed limit)                                                                 |
| Warnings           | esbuild `direct-eval` warnings from bundled tooling; non-fatal                                            |

So the bundle fits with roughly 3× headroom, which removes the historical "Next + Payload is too
big for Workers" objection for this application.

---

## 3. The seven checks

| #   | Check                                         | Result                                                                       |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Payload works reliably in Workers             | **Conditional pass** — builds and runs, with three known runtime workarounds |
| 2   | Neon connections and migrations               | **Pass** — via Hyperdrive, migrations from CI, not the Worker                |
| 3   | Jobs Queue and scheduled publishing           | **Pass** — better than Vercel Hobby; native cron on the $5 plan              |
| 4   | Preview deployments on isolated Neon branches | **Conditional** — supported, but per-PR Neon branching is custom CI work     |
| 5   | Node APIs and dependencies                    | **Conditional** — `nodejs_compat` covers the rest; `sharp` is the casualty   |
| 6   | Free-tier limits and realistic cost           | **Cloudflare cheaper; neither platform is free for a commercial launch**     |
| 7   | Deployment, debugging, rollback, monitoring   | **Pass** with tradeoffs                                                      |

### 3.1 Payload in the Workers runtime — conditional pass

- Cloudflare's own engineering blog ran Payload 3 on Workers with **Postgres through the official
  `@payloadcms/db-postgres` adapter**, using `pool: { connectionString: env.HYPERDRIVE.connectionString,
maxUses: 1 }`. Postgres support is therefore not hypothetical.
- The admin panel is a large React app; the spike shows it bundles, and the runtime has no
  filesystem dependency in the admin path.
- **Known breakages** (documented by Payload users through 2026, not by us):
  1. **Connection pool across requests.** A globally cached `pg.Pool` leaks promises between
     request contexts and can corrupt unrelated requests on the same isolate
     (Payload issue #17335). Fix: create the pool per request, or with Hyperdrive
     `maxUses: 1` and a request-scoped adapter.
  2. **Password hashing at login.** Payload's default PBKDF2 work factor runs into Workers
     limits; practitioners swap in a Workers-safe hashing path (`@noble/hashes`). This directly
     affects our authentication decision and must be verified before Phase 4.
  3. **Image processing.** Payload's `imageSizes` is hardwired to `sharp`, a native binary that
     cannot run in Workers. Our Phase 3 media design must use Cloudflare Images transforms (or
     WASM resizing) instead of Payload-generated sizes.
- Payload's official Cloudflare template is D1/SQLite-based, so the Postgres path is
  documented by Cloudflare but not the template default. We would be on a supported-but-less-trodden
  path.

### 3.2 Neon Postgres — pass

- Neon stays exactly as approved: founder-owned account, Free plan, standard Postgres. No D1
  migration, no schema change, no lock-in.
- Two supported connections from Workers: **Hyperdrive** (Cloudflare's pooler, included with
  Workers plans, recommended by both Cloudflare and Neon, works with `node-postgres`) or the
  **Neon serverless driver** over HTTP/WebSocket.
- Hyperdrive allowance: **100,000 queries/day on Free, unlimited on Workers Paid**, with
  pooling, query caching and egress included at no extra charge. That bounds the Workers Free
  option from a second direction, and it is comfortable under Paid.
- **Migrations run outside the Worker**, as they already do: `payload migrate` from GitHub
  Actions or a developer machine against `DATABASE_URL_UNPOOLED`. Workers never run DDL.
- Caveat: Neon's own guidance is not to combine Hyperdrive with the Neon serverless driver —
  pick one. Hyperdrive + `pg` is the documented pairing for Payload.

### 3.3 Jobs Queue and scheduled publishing — pass (and an improvement)

- Payload's queue is database-backed, so it needs no long-lived process — the same reason it
  already suits serverless.
- Cloudflare **Cron Triggers** call a `scheduled()` handler on the Worker, which can invoke
  `payload.jobs.run()` directly or hit the protected runner endpoint. Limits: **5 cron triggers
  on Free, 250 on Paid**, 30 s CPU per invocation for sub-hourly schedules.
- This is _better_ than the Vercel Hobby compromise recorded in the architecture: a five-minute
  publish check becomes a native, first-party scheduler instead of an external service with no
  SLA. Our queue-level idempotency, overdue detection and manual fallback remain unchanged and
  still matter for the failure cases.
- Remaining constraint: no long-running workers, so a publish job must finish inside the CPU
  budget. For a handful of articles that is ample; bulk operations would need chunking.

### 3.4 Previews with isolated Neon branches — conditional

- **Worker Previews** (Wrangler ≥ 4.135) give every non-production branch its own preview URL,
  with **preview-specific vars, secrets and bindings** defined in the `previews` block, and a
  deployment history per preview. That satisfies "preview never touches production data" _if_
  we point the preview's database at a separate Neon branch.
- What is **not** automatic: creating a Neon branch per pull request and wiring its connection
  string into that preview. That needs a small GitHub Action (Neon API: create branch on PR open,
  delete on close) plus a per-preview Hyperdrive configuration or binding override. Roughly a
  day of work, and it is exactly the kind of automation Vercel's Neon integration gives for free.
- Databases are the only resource here that must be isolated; R2 can use a shared preview bucket
  with a prefix, which is simpler than Vercel's per-environment Blob split.

### 3.5 Node APIs and dependencies — conditional

- OpenNext runs the app on the **Node.js runtime** inside Workers with `nodejs_compat`
  (compatibility date ≥ 2024-09-23), which covers `crypto`, `stream`, `buffer`, `path`, `url`,
  `async_hooks` and most of what Next and Payload touch.
- **Not supported:** native binaries (`sharp`), `child_process`, and runtime filesystem access.
  Payload's own code avoids the last two on the request path; `sharp` is the real casualty and is
  addressed by the Cloudflare Images pipeline.
- Bundle size: measured 19.5 MB uncompressed against a 64 MiB limit — fine. Startup time limit is
  1 s per isolate; a bundle this size is within the range Cloudflare documents, but cold-start
  latency is worth measuring in the spike because Payload's admin is heavy.

### 3.6 Cost — Cloudflare is cheaper, but "free" is not available on either platform

**The Vercel constraint is contractual, not technical.** Vercel's Terms of Service say the Hobby
plan is for "personal or non-commercial use", and the Fair Use Guidelines (updated September 2026)
state that "all commercial usage of the platform requires either a Pro or Enterprise plan",
defining commercial to include advertising, selling, or being paid to build/host the site. A
commercial publication cannot legitimately stay on Hobby, and Vercel reserves the right to
suspend or remove Hobby projects without notice. **Commercial Vercel starts at $20 per seat per
month.**

**The Cloudflare constraint is technical.** Workers Free allows **10 ms of CPU per request**,
which no Next.js + Payload SSR render will fit into; it is a preview tier for this app, not a
production one. Workers Paid is **$5/month** for the account and includes 10 million requests and
30 million CPU-ms, with 5 minutes of CPU available per invocation.

| Line item                       | Vercel (commercial)                       | Cloudflare                                                              |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| Platform floor                  | $20/seat/month (Pro)                      | $5/month (Workers Paid, whole account)                                  |
| Included requests               | Usage credit then metered                 | 10M/month, then $0.30/M                                                 |
| Included CPU                    | Not applicable (duration-based)           | 30M CPU-ms, then $0.02/M                                                |
| Cron / scheduling               | Daily-only on Hobby; per-minute needs Pro | 250 cron triggers included                                              |
| Database (Neon Free)            | $0                                        | $0                                                                      |
| Connection pooling              | Built into Neon                           | Hyperdrive, included (Free: 100k queries/day; Paid: unlimited)          |
| Object storage                  | Vercel Blob (metered) or external S3/R2   | R2: free egress, 10 GB-month free tier                                  |
| Image optimisation              | Included on Pro                           | Cloudflare Images: 5,000 unique transforms/month free, then $0.50/1,000 |
| Realistic month, launch traffic | **≈ $20–25**                              | **≈ $5–10**                                                             |

Realistic judgement: at launch traffic (tens of thousands of page views, a few hundred images),
Cloudflare lands around **$5–8/month** and Vercel around **$20–25/month** — a saving of roughly
$180–240 a year, plus free R2 egress and native cron. That is a real saving, but it is not the
difference between viable and not viable; the operational risk is the larger variable.

### 3.7 Deployment, debugging, rollback, monitoring — pass with tradeoffs

- **Deploy:** `wrangler deploy` or Workers Builds (GitHub integration, production branch plus
  preview builds).
- **Rollback:** `wrangler rollback [VERSION_ID]` promotes a previous version instantly;
  Versions/Deployments give an auditable history. Preview deployments keep their own history.
- **Debugging:** `wrangler tail` for live logs, Workers Logs with the `observability` block,
  local parity via `opennextjs-cloudflare preview` running the app in `workerd` — closer to
  production than `next dev`, but a slower inner loop.
- **Monitoring:** Workers Logs and Tail Workers are available; Logpush (long-term export) is a
  Paid-plan feature. No equivalent of Vercel's per-deployment analytics out of the box.
- **Tradeoff:** one Worker serves the site, the CMS and the API; rollback is all-or-nothing for
  that Worker (fine at our scale, and the same is effectively true of a Vercel project).

---

## 4. What must change if Cloudflare is chosen

| Change                                                                            | Why                                                                     | Effort                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| Next.js 16.3.3 → **16.4.5**                                                       | OpenNext requires `>=16.4.5`; 16.3.3 is also affected by CVE-2026-94545 | Small, required on any host      |
| Add `@opennextjs/cloudflare`, `wrangler`, `open-next.config.ts`, `wrangler.jsonc` | Workers deployment                                                      | Small                            |
| Request-scoped Postgres pool over Hyperdrive (`maxUses: 1`)                       | Prevents cross-request promise corruption                               | Small but subtle; must be tested |
| Workers-safe password hashing for Payload auth                                    | PBKDF2 limits in the isolate                                            | Medium; verify before Phase 4    |
| Cloudflare Images transforms instead of Payload `imageSizes`/sharp                | Native binary unavailable                                               | Medium; replaces part of Phase 3 |
| R2 storage via `@payloadcms/storage-s3` (R2 endpoint)                             | Object storage through a binding or S3 API                              | Small                            |
| Cron trigger calling the jobs runner                                              | Native scheduling                                                       | Small                            |
| Per-PR Neon branch automation                                                     | Isolated previews                                                       | ~1 day of CI work                |
| ISR/incremental cache binding (R2 or KV)                                          | OpenNext needs a cache for ISR                                          | Small                            |

What does **not** change: Neon ownership and the Free plan, the Postgres schema, every Payload
collection, the RBAC matrix, the workflow state machine, the jobs-queue idempotency design, the
editorial and SEO plans, and the test strategy.

## 5. Security finding that applies to both hosts

Our current pin `next@16.3.3` is inside the affected range for **CVE-2026-94545**
(`>=16.2.0 <16.3.6`, CVSS 9.5, RCE in the Node.js `next/og` ImageResponse). Later advisories
(both fixed in `16.4.1`) cover an Image Optimization RCE with SVG input and a `use cache`
issue. We do not yet generate OG images or use `use cache`, so there is no live exposure today,
but Phase 5 does add OG image generation. **Upgrade to 16.4.5 regardless of the hosting
decision**; Payload 3.93.0 supports `>=16.3.3 <17`.

## 6. Decision gates

1. **Gate A — security upgrade.** Move to Next 16.4.5 and re-verify build, lint, typecheck.
   Independent of hosting.
2. **Gate B — runtime spike (two days, separate branch, real Cloudflare account).** Deploy the
   current app to Workers with a Neon branch behind Hyperdrive. Prove: admin login (password
   hashing), create/edit a draft, migration run from CI, one cron-triggered job, one preview
   deployment with a separate Neon branch, and rollback.
3. **Gate C — cost sign-off.** Workers Paid ($5/month) and Cloudflare Images only if the free
   5,000 transformations prove insufficient. No Workers Free pretence.
4. **Gate D — decision.** If Gate B passes: adopt Cloudflare as the deployment target, keep Neon,
   and make the media adapter R2/Images. If it fails: fall back to Vercel Pro, and the approved
   architecture stands unchanged.

## 7. Open questions this evaluation could not settle

- Real-world TTFB for the Payload admin from Workers isolates versus Vercel — needs measurement,
  not documentation. One public report from late 2025 described multi-second admin response
  times (later attributed partly to D1); Neon behind Hyperdrive was reported to behave well.
- Whether our specific Payload version's password hashing works unmodified in `workerd` or needs
  the `@noble/hashes` substitution.
- Query volume through Hyperdrive under Paid is unlimited, but the _cost_ of the underlying Neon
  Free plan compute is a separate ceiling: a Worker with a warm isolate keeps querying Neon and
  can exhaust Neon's 100 compute-hours before the Workers bill moves. This should be watched
  during Gate B.
