# Lumière Index — Architecture

Status: **proposed, awaiting founder approval** (2026-11-09).
Owner: Lumiere Media and Entertainment Technologies.
Publication: Lumière Index — *News that matters.*

This document is the approval artefact for the rebuild. No implementation is started
until it is signed off. Items still needing a founder decision are collected in
[§19](#19-open-decisions) and marked **OPEN**.

---

## 1. Scope of the initial release

In scope: the public publication, the CMS, the editorial workflow with server-enforced
roles, security, SEO, and a responsive reading experience on all listed routes.

Explicitly out of scope for release 1 (see [§17](#17-non-goals)):
ranking/scoring, a media studio, AI drafting, advertising, comments, localisation,
native apps, memberships/paywalls.

The retired product (a movie/TV ranking index) is **not** carried forward. Its code
stays recoverable at tag `legacy/index-beta2` (see [§18](#18-git-history-and-github-transition)).

---

## 2. Decision summary

| # | Decision | Choice | Status | Evidence |
|---|---|---|---|---|
| D1 | Framework | Next.js App Router + Payload CMS 3 embedded in one app | accepted by founder | Payload 3 is a Next-native CMS; one deployable, one auth system |
| D2 | Database | Neon Postgres (serverless, branching) | accepted by founder, confirmed here | [§4](#4-database-neon-postgres) |
| D3 | DB adapter | `@payloadcms/db-postgres` (not `db-vercel-postgres`) | proposed | portable; explicit connection string; not tied to Vercel env names |
| D4 | Authentication | Payload's own email/password auth on `Users` | proposed | no third-party auth needed; sessions and password hashing are built in |
| D5 | Authorisation | Custom Payload `access` functions + server-action checks | proposed | collection and field level, never UI-only |
| D6 | Media storage | Vercel Blob via `@payloadcms/storage-vercel-blob` | **OPEN** (alternative: R2 via S3 adapter) | [§7](#7-media-and-uploads) |
| D7 | Scheduling | Payload Jobs Queue + protected runner endpoint | proposed | [§6](#6-scheduling-and-the-jobs-queue) |
| D8 | Cron cadence | Vercel Pro per-minute **or** external scheduler fallback | **OPEN** | verified Vercel limits, [§6.4](#64-verified-vercel-cron-limits) |
| D9 | Timezone | UTC storage, per-user display timezone, publisher-set default | accepted by founder | [§8](#8-time-and-timezones) |
| D10 | Newsletter delivery | Provider not yet chosen; delivery is **not** claimed | **OPEN** | [§12](#12-newsletter) |
| D11 | Hosting | Vercel, single project, production branch `main` | accepted by founder | brief §4 |
| D12 | Licence | none yet; all rights reserved by default | **OPEN** | no `LICENSE` exists today |

---

## 3. Stack, versions and compatibility

Verified against Payload's published requirements on 2026-11-09.

| Layer | Choice | Constraint / note |
|---|---|---|
| Runtime | Node.js 24 LTS pinned in `.nvmrc`, CI and Vercel | Payload requires `^22.23.4 \|\| >=24.22.1` |
| Framework | Next.js `16.2.6+` (App Router) | Payload supports 15.2.9–15.2.x, 15.3.9–15.3.x, 15.4.11–15.4.x, **16.2.6+**. Fallback to 15.4.11+ if a Next 16 incompatibility appears |
| CMS | `payload` `3.93.x` | v4 is pre-release only; **do not** adopt v4 in this build |
| DB adapter | `@payloadcms/db-postgres` | Drizzle-based; works with any Postgres |
| Editor | Payload Lexical rich text | configured with a restricted feature set (§9) |
| Styling | Tailwind CSS 4 + design tokens | token-driven, no component library dependency tree |
| Validation | `zod` for form/API input | shared schemas between client and server |
| Images | `sharp` (Payload upload sizes) + `next/image` | no client-side image pipeline |
| Tests | `vitest`, Payload Local API, `@playwright/test`, `@axe-core/playwright` | [§14](#14-testing-strategy) |
| Lint/format | ESLint (flat config) + Prettier | enforced in CI |
| Package manager | npm, single root lockfile | replaces the previous dual `bun.lock` + `package-lock.json` drift |

Version policy: exact versions in `package.json`, one committed lockfile, Dependabot
weekly, and no major upgrades without a preview deploy and a green suite.

---

## 4. Database: Neon Postgres

### 4.1 Why Neon

1. **Payload is Postgres-first.** Collections, versions, drafts, relationships and the
   jobs queue are all relational; Payload ships a first-class Drizzle/Postgres adapter.
2. **Branching matches our preview model.** Each PR preview gets an isolated database
   branch, so preview publishing tests never touch production rows.
3. **Serverless connection pooling is included.** Pooled connections (PgBouncer) are
   available on every plan, which is what a Vercel function fleet needs.
4. **Scale-to-zero economics.** A publication's admin traffic is bursty; paying only for
   active compute suits this workload far better than a fixed instance.
5. **No lock-in.** It is standard Postgres over a normal connection string — no
   proprietary API, no SDK in application code. Leaving would be a `pg_dump`.
6. **First-party Vercel integration.** The integration sets `DATABASE_URL` (pooled),
   `DATABASE_URL_UNPOOLED` (direct) and the `PG*` pieces, and can provision a branch per
   preview deployment.

### 4.2 Verified pricing and limits (Free plan, checked 2026-11-09)

| Limit | Free | Consequence for us |
|---|---|---|
| Price | $0/month | sufficient for build-out and pre-launch |
| Postgres storage | 1 GB per project (20 GB account-wide) | ample: articles and metadata only, media lives in object storage |
| Compute | 100 CU-hours per project per month | 0.25 CU for ~400 h/month — far above editorial usage |
| Branches | 10 per project | main + preview + local dev fits comfortably |
| Projects | 100 | one is needed |
| Scale to zero | after 5 min idle, cannot be disabled | first request after idle pays a cold start (typically a few hundred ms) |
| On limit breach | compute suspends until the next billing period; **no data loss**, no overage billing | must be monitored, and upgraded before launch |

**Paid plan (Launch):** usage-based with no minimum. Neon's own worked example — a 0.25 CU
compute active 4 h/day — comes to roughly **$3–5/month** of compute. Storage is billed
separately per GB-month; the published rate differs between Neon's plan page and FAQ, so
the exact figure must be confirmed in the console at signup rather than quoted here.

**Recommendation:** build on Free, move to Launch before launch day (removes the
compute-suspension cliff and enables disabling scale-to-zero if cold starts prove
unacceptable), and never rely on the Free plan for production traffic.

### 4.3 Connection strategy

- **Runtime** (Next.js functions, admin, public pages): pooled `DATABASE_URL`.
- **Migrations and maintenance scripts**: direct `DATABASE_URL_UNPOOLED`, because
  transaction-mode pooling is the wrong place to run DDL.
- **Schema management**: `push: false` outside local development. Every schema change is
  a committed migration created with `payload migrate:create` and applied with
  `payload migrate` as an explicit deploy step — never implicitly at request time.
- **Pool sizing**: conservative `max` on the pool (serverless concurrency multiplies
  connections); rely on the pooler rather than raising limits.
- **Migrations are expand/contract**: additive in one release, destructive in a later one,
  so a Vercel rollback never meets an incompatible schema.

### 4.4 Integration path

**OPEN** — two supported routes, both giving preview branching:

- *Neon-managed* (recommended): create the Neon account directly, connect it to the Vercel
  project through the Marketplace "Connectable Accounts" flow. Billing stays with Neon, the
  database is independent of the Vercel plan, and the Neon console stays available.
- *Vercel-managed*: provision from Vercel's Storage tab with unified billing; simpler, but
  the database then lives inside a Vercel-managed organisation.

Either way the variable names we consume are the same (`DATABASE_URL`,
`DATABASE_URL_UNPOOLED`), so this choice does not affect application code.

### 4.5 Backups and recovery

Neon's instant restore/PITR is a paid-plan capability. Until the plan is upgraded:
a nightly `pg_dump` from a scheduled GitHub Action into encrypted object storage, with a
**quarterly restore drill** recorded in `docs/DEPLOYMENT.md`. A backup that has never been
restored is not a backup.

---

## 5. Repository structure

Single application, no monorepo, no nested second web app.

```text
/
├── src/
│   ├── app/
│   │   ├── (site)/            # public routes
│   │   │   ├── page.tsx                   /
│   │   │   ├── latest/                    /latest
│   │   │   ├── celebrity/                 /celebrity
│   │   │   ├── film-tv/                   /film-tv
│   │   │   ├── music/                     /music
│   │   │   ├── culture/                   /culture
│   │   │   ├── exclusives/                /exclusives
│   │   │   ├── features/                  /features
│   │   │   ├── article/[slug]/            article page
│   │   │   ├── tag/[slug]/                tag archive
│   │   │   ├── author/[slug]/             contributor page
│   │   │   └── (static)/                  about, contact, corrections, privacy, terms, newsletter
│   │   ├── (payload)/         # admin + Payload REST/GraphQL
│   │   ├── api/               # preview, revalidate, newsletter, health
│   │   ├── not-found.tsx
│   │   ├── error.tsx
│   │   └── layout.tsx
│   ├── components/            # presentational, server-first
│   ├── features/              # articles, sections, newsletter, search
│   ├── lib/                   # cms, seo, dates, media, permissions, env
│   └── styles/
├── payload/
│   ├── collections/           # one file per collection
│   ├── access/                # role predicates, document rules
│   ├── fields/                # shared field groups
│   ├── hooks/                 # slug, workflow guards, audit
│   ├── tasks/                 # jobs queue tasks
│   ├── migrations/
│   └── payload.config.ts
├── tests/{unit,integration,e2e}
├── docs/
├── .github/{workflows,ISSUE_TEMPLATE}
└── public/
```

Rules: no `any` in application code, no CMS access from client components, no secrets
outside environment variables, and every route that reads content is server-rendered.

---

## 6. Scheduling and the Jobs Queue

### 6.1 Model

Payload's Jobs Queue gives us durable, database-backed jobs with stored status, errors and
retry counts — visible in the admin — instead of a fire-and-forget HTTP call.

Tasks (one file each, in `payload/tasks/`):

| Task | Queue | Retries | Purpose |
|---|---|---|---|
| `publishScheduledArticle` | `publishing` | 3 | publish an article whose scheduled time has passed |
| `sendSubscriberConfirmation` | `email` | 3 | double opt-in email (Phase 5) |
| `revalidateContent` | `default` | 2 | invalidate cache tags after publish/unpublish |
| `sendWorkflowNotification` | `email` | 2 | notify editors of submissions/approvals (Phase 5) |

`autoRun` is **never** used: Payload's own docs state it must not be used on serverless
platforms. Running and scheduling are triggered through the endpoints Payload mounts:

- `GET /api/payload-jobs/run` — runs queued jobs, and handles schedules by default.
- `GET /api/payload-jobs/handle-schedules` — duplicates a schedule into the queue only.

Both are locked down with `jobs.access.run` checking
`Authorization: Bearer ${CRON_SECRET}` — the header Vercel automatically supplies to
cron-triggered invocations when `CRON_SECRET` is set on the project.

### 6.2 Idempotency and duplicate-publication protection

Scheduled publishing is the one place where a bug becomes a visible editorial incident, so
it is protected at four levels:

1. **Version pinning.** The job records `articleId`, `scheduledFor` and the approved
   `versionId`. The task re-reads the article and aborts if the current version differs —
   content edited after scheduling is never published unreviewed.
2. **Guarded transition.** The status change is a conditional update
   (`where: { id, status: 'scheduled', scheduledFor: { less_than_equal: now } }`). If it
   matches zero documents, another run already did it and the job exits successfully
   without side effects.
3. **Database-level uniqueness.** A `publicationEvents` collection carries a unique
   compound index on (`article`, `version`); a second successful publish of the same
   version cannot be recorded, and the task treats that error as "already published".
4. **Job-level dedupe key.** Each scheduled article has one pending job keyed by
   `article:<id>:<versionId>`; scheduling twice updates the existing job rather than
   queueing a second one.

### 6.3 Failure handling

Retries use the task's `retries` setting with exponential backoff. After the final failure:
the article moves to `publish_failed`, the job keeps its error in the admin, a
`workflowEvents` row records `actor: system`, and (Phase 5) the managing editors are
notified. Nothing is retried forever, and no failure is silent — the admin dashboard shows
a count of failed jobs, and `/api/health` reports queue depth.

### 6.4 Verified Vercel cron limits (checked 2026-11-09)

| | Hobby | Pro / Enterprise |
|---|---|---|
| Cron jobs per project | 100 | 100 |
| Minimum interval | **once per day** — more frequent expressions fail the deployment | once per minute |
| Scheduling precision | anywhere within the scheduled hour (±59 min) | per minute |
| Timezone | UTC only | UTC only |
| Built-in retries / alerts | none | none |

Consequences, stated plainly:

- Minute-accurate scheduled publishing **requires the Pro plan**. On Hobby the platform
  rejects `*/5 * * * *` at deploy time, so this is not a soft limitation.
- Vercel cron has no retries and no failure alerts, which is exactly why the retry and
  failure logging live in Payload's queue rather than in the trigger.
- Because the trigger only *runs* the queue, a missed or late cron invocation delays
  publication but never duplicates it — the next run picks up the same job.

**OPEN — cadence plan.** Options, in order of preference:

1. **Vercel Pro, one cron per minute on `/api/payload-jobs/run?queue=publishing`.** Cleanest,
   supported path; publishing lands within a minute of the scheduled time.
2. **Hobby + external scheduler** (GitHub Actions `schedule` at the minimum 5-minute
   granularity, or any external cron) hitting the same endpoint with `CRON_SECRET`.
   Free, but GitHub's scheduler is routinely delayed under load and offers no SLA; we would
   publish "within roughly 5–15 minutes" and document that publicly-visible reality rather
   than claim precision we do not have.
3. **Daily-only scheduling on Hobby.** Acceptable for a launch with no intraday publishing,
   but it contradicts an editorial desk that schedules morning and evening slots.

Recommendation: option 1 at launch; option 2 as the interim path while building.

---

## 7. Media and uploads

Vercel has no persistent filesystem, so media must live in object storage.

- **Recommended:** `@payloadcms/storage-vercel-blob` with `BLOB_READ_WRITE_TOKEN`.
  Same platform, same billing, no extra vendor. Note Payload's documented constraint that
  Vercel server uploads are limited to 4.5 MB, so client-side uploads are enabled
  (`clientUploads: true` with Payload's upload route) and the collection caps size at 12 MB.
- **Alternative (OPEN):** Cloudflare R2 through `@payloadcms/storage-s3` with an R2
  endpoint. Cheaper egress at scale, but a second vendor and a second set of credentials.
  Payload's `storage-r2` adapter is Workers-only and is *not* the right package here.

Media collection rules:

- `alt` required; `caption` optional; `credit` (photographer/agency) optional;
  `licence` required enum (`owned`, `licensed`, `press-kit`, `public-domain`, `unknown`);
  `licenceNotes` required whenever `licence` is not `owned`.
- An image with `licence: unknown` cannot be attached to a `published` article — enforced
  in a validation hook, not by editorial convention.
- Accepted types: JPEG, PNG, WebP, AVIF. SVG uploads are rejected (script vector).
- Sharp generates responsive sizes; `next/image` consumes them; focal point is stored.
- Uploads are restricted to authenticated staff; there is no public upload path.

No asset from the retired product is reused unless provenance is confirmed in writing
(the previous hero still is a film still of unverified licensing).

---

## 8. Time and timezones

- **Storage:** every timestamp is an instant in UTC (`timestamptz`, ISO-8601 in the API).
  No local-time strings are ever persisted.
- **Editorial default:** a `publicationTimezone` setting (IANA identifier, validated) held
  in a Payload global and editable only by Administrator/Publisher. It is **not** hardcoded
  to `America/New_York`; the seed value is `UTC` until the founder sets one.
- **Per-user preference:** `Users.timezone` (IANA, optional). When set, all admin dates,
  schedule previews and workflow timestamps render in that zone; when empty, the user
  inherits `publicationTimezone`.
- **Rendering:** one helper (`src/lib/dates.ts`) wraps `Intl.DateTimeFormat` with an
  explicit zone and locale. Formatting without an explicit zone is disallowed by lint rule.
  Rendered times carry `<time dateTime="…">` with the UTC instant.
- **Scheduling UI:** shows both — "Scheduled for 09:00 (Europe/London) · 09:00 UTC" — and
  the confirmation step restates the instant, so a DST boundary cannot silently move a
  publication slot.
- **Recurring tasks:** cron expressions run in UTC (Vercel has no timezone setting), and any
  fixed-local-time recurring task documents its DST drift. Per-article scheduling is stored
  as an instant, so it is unaffected.
- **Tests:** DST transition cases (spring-forward gap, autumn overlap) are unit-tested.

---

## 9. Content model

| Collection | Purpose | Notable fields |
|---|---|---|
| `articles` | all editorial content | title, slug, dek, section (rel), format (rel), authors (rel, ordered), tags (rel), heroMedia (rel), body (Lexical), status, scheduledFor, publishedAt, updatedAt, isExclusive, exclusivityRationale, opinionDisclaimer, seo group, versions(drafts) |
| `sections` | Latest/News, Celebrity, Film & TV, Music, Culture, Exclusives, Features | name, slug, description, seo, order, isPublic |
| `formats` | Breaking, News, Exclusive, Interview, Feature, Analysis, Opinion | name, slug, rules copy, requiresRationale flag |
| `authors` | bylines / contributors | name, slug, role, bio, avatar, socials, isStaff |
| `tags` | topic taxonomy | name, slug, description |
| `media` | images and documents | file, alt, caption, credit, licence, licenceNotes, focalPoint |
| `users` | staff accounts | email, password, name, roles[], timezone, active |
| `corrections` | corrections and clarifications | article (rel), type, summary, correctedAt, approvedBy, isPublic |
| `subscribers` | newsletter list | email (unique), status, consentedAt, consentSource, unsubscribeToken, tags[] |
| `workflowEvents` | immutable audit log | article, actor, fromStatus, toStatus, note, jobId, createdAt |
| `publicationEvents` | publish/unpublish record + dedupe | article, version, publishedAt, actor, unique(article, version) |

Design notes:

- `articles` uses Payload **versions with drafts**, which is what makes preview and the
  revision cycle possible without a parallel table.
- Exclusives require `exclusivityRationale` (min length enforced) before `in_review`;
  Opinion requires `opinionDisclaimer`; Analysis is distinguishable from reported news by
  format, and the article template renders the format label on every article.
- No numeric score, ranking, or "index position" fields exist anywhere in the schema.
- Rich text is deliberately constrained: headings, bold/italic, links, blockquote, lists,
  images, embeds (YouTube only, privacy-friendly), pull quotes, and footnotes.
  No raw HTML, no arbitrary script.

---

## 10. Authentication and roles

**Authentication** is Payload's built-in email/password auth on `Users`: hashed passwords,
HTTP-only session cookies, configurable token lifetime, and password reset through the
configured mail provider. No third-party identity provider is introduced; there is no
public sign-up — accounts are created by an Administrator.

**Roles** are a `roles` array field, and authorisation lives in code:

```text
payload/access/isAdmin.ts
payload/access/hasRole.ts        // hasRole('publisher')
payload/access/articles.ts       // per-operation, per-document rules
payload/access/fields.ts         // field-level: e.g. only Publisher sets status=published
```

Six roles, one capability matrix (abridged; the full matrix ships as
`docs/EDITORIAL_WORKFLOW.md`):

| Capability | Contributor | Writer | Editor | Managing Editor | Publisher | Administrator |
|---|---|---|---|---|---|---|
| Create/edit own draft | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit others' drafts | — | — | ✅ | ✅ | ✅ | ✅ |
| Submit for review | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Request changes / approve | — | — | — | ✅ | ✅ | ✅ |
| Schedule publication | — | — | — | — | ✅ | ✅ |
| Publish / unpublish | — | — | — | — | ✅ | ✅ |
| Manage sections, tags, formats | — | — | — | ✅ | ✅ | ✅ |
| Manage users and roles | — | — | — | — | — | ✅ |
| Manage subscribers / corrections | — | — | — | ✅ | ✅ | ✅ |
| Read audit log | — | — | own articles | ✅ | ✅ | ✅ |

Rules that follow from the brief: a Writer never receives publishing rights implicitly;
promotion is an explicit role change by an Administrator; every check runs on the server
(Payload access + server actions), and the UI merely reflects the result. Deleting is
soft (unpublish + archive) for anyone below Administrator.

**Security controls** (Phase 4 exit criteria): session cookie `HttpOnly`/`Secure`/
`SameSite=Lax`, CSRF protection on mutations, rate limiting on login and newsletter
endpoints (database-backed, no extra service), constant-time secret comparison,
no account enumeration in password reset, and every admin action written to
`workflowEvents`.

---

## 11. Publishing workflow

```text
draft ──submit──▶ in_review ──request changes──▶ changes_requested ──resubmit──▶ in_review
                     │
                     └──approve──▶ approved ──schedule──▶ scheduled ──job──▶ published
                                                                     │
                                                              failure └──▶ publish_failed
published ──unpublish──▶ archived        published ──correction──▶ published (+ correction record)
```

Guards:

- `in_review` requires a title, dek, section, format, at least one author, body of minimum
  length, and (for exclusives) a rationale.
- `approved` can only be set by Managing Editor or above, and records who approved which
  version.
- `scheduled` requires `scheduledFor` in the future **and** an approved version; editing the
  body after scheduling reverts the article to `changes_requested` and cancels the job.
- `published` sets `publishedAt` once and never rewrites it on later edits; substantive
  post-publication edits create a version and, where required, a `corrections` record.
- Only `published` articles are reachable from public routes, sitemaps or RSS.

**Preview** uses Next draft mode plus a Payload preview URL. The preview route verifies a
signed, short-lived token bound to the document and version, sets draft mode, and redirects
to the article. Preview requests are `noindex`, never cached publicly, and can never write.
Publishing requires the explicit transition above — preview has no path to it.

---

## 12. Newsletter

- The briefing is **The Lumière Briefing**.
- `subscribers` is the source of truth: email (unique, normalised), status
  (`pending`/`confirmed`/`unsubscribed`/`bounced`), `consentedAt`, `consentSource`
  (page + campaign), unsubscribe token, and created/updated instants.
- Double opt-in: submission creates a `pending` row and sends a confirmation link;
  only a click moves it to `confirmed`. Unsubscribe is a single click from any email and
  works without login.
- Rate limited per IP and per address; responses never reveal whether an address exists.
- **Delivery is not claimed** anywhere in the product copy until a provider is configured,
  a test send to a real inbox succeeds, and unsubscribe/delivery webhooks are verified.
  Until then the signup stores consent and the UI says the briefing is coming soon.
- **OPEN — provider.** Resend is the current preference (simple API, workable free tier,
  broadcasts plus transactional). Postmark is the deliverability-focused alternative;
  beehiiv would replace our own list management, which conflicts with keeping subscribers
  in the CMS. Decision can wait until Phase 5; nothing in Phases 1–4 depends on it.

---

## 13. SEO, performance, accessibility

- Metadata API per route and per article; canonical URLs; OG/Twitter images generated from
  the article's hero, not a stock fallback.
- JSON-LD: `NewsArticle` (with `datePublished`, `dateModified`, `author`, `publisher`),
  `Organization`, `BreadcrumbList`, `WebSite` with search action.
- `sitemap.xml` generated from published content only, split by section; `news-sitemap.xml`
  for the last 48 hours; `robots.txt` disallows `/admin`, `/api`, and any preview host;
  preview deployments send `X-Robots-Tag: noindex`.
- RSS 2.0 for published articles, plus per-section feeds.
- Rendering: server components, cache tags revalidated on publish/unpublish, no client-side
  CMS fetching on public pages, font subsetting with `next/font`, explicit image dimensions
  to protect CLS. Budget: LCP < 2.5 s on 4G mobile for an article page, CLS < 0.1,
  no third-party script in the critical path.
- Accessibility: semantic landmarks, visible focus, 4.5:1 contrast for body text, keyboard
  operable menus and dialogs, `prefers-reduced-motion` respected, and axe checks in E2E.

---

## 14. Testing strategy

| Level | Tool | Scope |
|---|---|---|
| Unit | vitest | date/timezone helpers, slugging, permission predicates, SEO builders, validation schemas |
| Integration | vitest + Payload Local API against a throwaway Postgres | every access rule for every role; every workflow transition including illegal ones; publish idempotency (double-run the task, assert one publication); unauthenticated REST requests return 401/403 with no data |
| E2E | Playwright + axe | the 20-step publishing script from the brief, run against a seeded app with its own database branch |
| CI | GitHub Actions | install → format check → lint → typecheck → unit → integration → build, on every PR and every push to `main` |

The 20-step manual script becomes `tests/e2e/publishing.spec.ts`, with steps 11–16 covering
public visibility, correction, unpublish, and the guarantee that a draft URL 404s for a
signed-out visitor.

Integration tests run against a real Postgres (Neon branch or `postgres:16` service in CI),
not SQLite — Postgres-specific behaviour is part of what we are testing.

---

## 15. Environments and secrets

| Environment | App | Database | Purpose |
|---|---|---|---|
| Local | `next dev` on the developer machine | Neon `dev` branch (or local Postgres) | development, fixtures only |
| Preview | every PR, Vercel preview deployment | **its own Neon branch** | review, E2E, editorial QA |
| Production | `main`, Vercel production | Neon `main` branch | public site |

- Testers on preview get `noindex` headers, a seeded editor account, and **never**
  production content or production credentials.
- Environment variables (complete list lives in `.env.example` with placeholders):

```text
DATABASE_URL               # pooled
DATABASE_URL_UNPOOLED      # direct, migrations only
PAYLOAD_SECRET             # per-environment, 32+ random bytes
NEXT_PUBLIC_SITE_URL       # https://lumiereindex.com / preview URL
PREVIEW_SECRET             # draft-mode token signing
CRON_SECRET                # runner endpoint auth (also read by Vercel cron)
BLOB_READ_WRITE_TOKEN      # media (Phase 3)
RESEND_API_KEY / EMAIL_FROM  # Phase 5 only
```

- Secrets live only in Vercel's environment settings and `.env.local` (gitignored).
  No secret is committed, pasted into chat, or printed in logs. `.env.example` contains
  names and descriptions only.
- Production, preview and local use different `PAYLOAD_SECRET` values, so a token minted
  in one environment is invalid in another.

---

## 16. Deployment model

- One Vercel project, repo root, `next build`, Node 24, region co-located with the Neon
  primary.
- Flow: PR → preview deployment + branch database → review → merge to `main` →
  migrations applied (explicit step, not build-time) → production deploy → smoke checklist.
- Smoke checklist (documented in `docs/DEPLOYMENT.md`): homepage renders latest content,
  an article page renders with correct metadata, sitemap contains only published URLs,
  `/admin` login works for an Editor, draft URL 404s when signed out, search endpoint
  returns 200, 404 page renders.
- Rollback: Vercel instant rollback to the previous deployment, safe because migrations are
  expand/contract.
- **Production deployment stays on hold** until the founder approves Phase 7. The existing
  production site is not touched by Phase 1–6 work.
- Domain cutover (`lumiereindex.com`) is a Phase 7 step with a lowered TTL beforehand,
  a verified preview of the final build, and an explicit go/no-go.

---

## 17. Non-goals

Excluded from release 1, deliberately: ranking or scoring of any kind; a video/media studio;
AI-generated copy; advertising and ad-tech; comments and user accounts for readers;
paywalls/memberships; multi-language; native apps; a mobile editorial app; a public API
for third parties; automated social posting.

The CMS is built for a newsroom of a handful of editors, not for a media conglomerate.
Anything that only pays off at ten times the current scale is deferred.

---

## 18. Git history and GitHub transition

### 18.1 Preservation (done, verified 2026-11-09)

- The retired product is tagged **`legacy/index-beta2`** → `bd26e72` as a local annotated
  tag.
- The same commit is preserved **on GitHub** as branch `refs/heads/legacy/index-beta2`,
  push-verified against `bd26e72`. A tag cannot be pushed from this environment (plain git
  has no GitHub credentials; the managed helper pushes branches only), so the remote
  recovery reference is a branch. It is functionally equivalent: the ref points at the same
  commit, carrying the full 215-commit history.
- `refs/heads/master` on the remote is still `bd26e72`, so there are now **two** independent
  remote references to the retired tree, plus every merged PR (#1–#36).
- History is **not** rewritten, squashed or discarded.
- The 280 working-tree deletions remain **uncommitted**, so `git checkout -- .` restores the
  old tree exactly.
- Recovery recipe (any future date): `git fetch origin legacy/index-beta2` then
  `git checkout -b restore-legacy FETCH_HEAD`, or check out the tag locally.
- Do not delete `legacy/index-beta2` (tag or branch) as part of any cleanup.

### 18.2 Current state, verified

| Item | Finding |
|---|---|
| Default branch | `master` |
| CI trigger | `.github/workflows/tests.yml` — `push: branches: [master]` + all PRs |
| Other `master` references in repo | `TRUST_RELEASE.md:15` only |
| Vercel config in repo | `lumiere-the-index-codebase/vercel.json` (old frontend, not root) |
| Lovable coupling | 11 files (`lumiere-the-index-codebase/AGENTS.md`, `vite.config.ts`, `__root.tsx`, `apiClient.ts`, `lovable-error-reporting.ts`, `package.json`, `bunfig.toml`, `.gitignore`, both lockfiles) |
| Branch protection / secret scanning | not visible from here — founder console action |

### 18.3 `master` → `main` migration, ordered

This is a remote, hard-to-reverse change, so it happens in one planned window **after**
the new baseline exists and is green — not now.

1. **Gate 0 — disconnect Lovable** (or revoke its write access) *before* the first new
   commit lands on the default branch. Otherwise its editor can push the retired app back
   over the new tree. Verify by watching for a bot push after the next commit.
2. **Gate 1 — new code lands on a branch** (`phase-1/foundation`) as a draft PR. `master`
   stays untouched and deployable throughout.
3. **Gate 2 — new CI is proven** on that PR: format, lint, typecheck, unit, integration,
   build all green. The old workflow file is replaced in the same PR (it targets a `backend/`
   directory that no longer exists).
4. **Gate 3 — Vercel is pointed at the new project first.** Either a new Vercel project
   whose Production Branch is `main`, or the existing project's Production Branch updated in
   the same window. Critically: the old project's automatic production deploys from `master`
   are disabled, so a stale `master` cannot serve the retired app or a half-migrated tree.
5. **Gate 4 — rename.** GitHub *Settings → Branches → rename `master` to `main`*. This
   moves open PR bases and resets branch-protection targeting; protection must be re-applied
   to `main` immediately afterwards.
6. **Gate 5 — verify.** A no-op commit to `main` produces: green CI, a Vercel production
   deployment from `main`, and no deployment from `master`.
7. **Gate 6 — protection and scanning.** Ruleset on `main`: require PR, require the CI
   checks, block force-push and deletion, require conversation resolution; enable secret
   scanning and push protection.
8. **Cleanup.** Keep `legacy/index-beta2` permanently. Archive stale `feature/*` branches
   after 30 days; never delete the tag or `master`'s commit history.

Failure modes and why the order matters: if Vercel's production branch is still `master`
when the branch is renamed, production deployments stop (safe, visible, reversible). If the
rename happens first and Vercel falls back to `main`, unreviewed code could publish
(unsafe). Hence Vercel before rename, never the reverse.

---

## 19. Open decisions

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| O1 | Neon integration path (Neon-managed vs Vercel-managed) | Neon-managed | Phase 1 |
| O2 | Cron cadence: Vercel Pro per-minute, external scheduler, or daily-only | Pro at launch; external scheduler interim | Phase 3 |
| O3 | Media storage: Vercel Blob vs Cloudflare R2 | Vercel Blob | Phase 3 |
| O4 | Newsletter provider | Resend (defer to Phase 5) | Phase 5 |
| O5 | `LICENSE` / rights statement | private, all rights reserved | before first public commit |
| O6 | Default branch rename window (`master` → `main`) | after CI green, before launch | Phase 1/7 boundary |
| O7 | Lovable disconnect | disconnect before baseline commit | Phase 1 |
| O8 | Production URL canonical host (`lumiereindex.com` vs `www`) | apex canonical, `www` 301 | Phase 5 |
| O9 | Editorial timezone seed value | founder sets `publicationTimezone` | Phase 3 |

---

## 20. Phases and exit criteria

| Phase | Deliverable | Exit criteria |
|---|---|---|
| 1 | Foundation: baseline commit, repo docs, `.env.example`, strict TS/ESLint/Prettier, Next+Payload scaffold, CI | `npm run lint`, `typecheck`, `test`, `build` all green in CI on a branch; admin loads locally against the dev database |
| 2 | Design system and public pages against fixtures | all 14 routes render, responsive, axe clean on key pages, Lighthouse ≥ 90 on a fixture article |
| 3 | CMS, media, auth | articles/media/authors/sections work end to end; uploads carry licence; login and password reset work |
| 4 | Roles, workflow, scheduling | capability matrix enforced in integration tests; scheduled publish fires once; failed job surfaces in admin |
| 5 | SEO, RSS, newsletter | only published content indexed; sitemap/RSS valid; double opt-in and unsubscribe verified with a real inbox |
| 6 | Testing | the 20-step script passes as Playwright E2E; unauthorised API access rejected; a11y and performance budgets met |
| 7 | Production prep | backups + restore drill, env docs, smoke checklist, DNS plan — **deployment only with explicit approval** |

Dependencies: 2 and 3 both need 1; 4 needs 3; 5 needs 4; 6 spans 2–5; 7 needs all.

---

## 21. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Payload/Next version incompatibility | build blocked | pin to the verified ranges; no v4 pre-releases; upgrade only behind a preview deploy |
| Next 16 cache/Cache Components friction with Payload | subtle staleness | keep cacheComponents off initially; tag-based revalidation with explicit tests |
| Vercel Hobby cron rejects sub-daily jobs | scheduling unavailable | cadence decision O2 resolved before Phase 4 |
| Neon Free compute suspension | admin outage | monitor CU-hours, upgrade to Launch before launch |
| Cold starts after scale-to-zero | first-request latency | measure in Phase 6; disable scale-to-zero on paid plan if it matters |
| Unlicensed imagery | legal exposure | licence field is mandatory and validated; no legacy assets reused |
| Branch rename or Vercel misconfiguration | production serving stale/broken code | the gated order in §18.3, done in one window |
| Lovable re-syncing the old app | work overwritten | Gate 0 disconnect before baseline |
| Single-maintainer bus factor | delivery risk | docs-first, no tribal knowledge, everything reproducible from the repo |
| No backups exist today | data loss | nightly dump + restore drill before launch |
