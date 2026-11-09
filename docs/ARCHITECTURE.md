# Lumière Index — Architecture

Status: **rev. 2 — founder decisions of 2026-11-09 incorporated; awaiting final sign-off.**
Owner: Lumiere Media and Entertainment Technologies.
Publication: Lumière Index — _News that matters._

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

| #   | Decision                | Choice                                                                                   | Status              | Evidence                                                               |
| --- | ----------------------- | ---------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| D1  | Framework               | Next.js App Router + Payload CMS 3 embedded in one app                                   | accepted by founder | Payload 3 is a Next-native CMS; one deployable, one auth system        |
| D2  | Database                | Neon Postgres, founder-owned account, **Free plan**, env-var connection                  | accepted by founder | [§4](#4-database-neon-postgres)                                        |
| D2b | Cost policy             | $0 recurring baseline; no paid tier without a written cost decision                      | accepted by founder | [§4.6](#46-cost-governance-and-free-tier-guardrails)                   |
| D3  | DB adapter              | `@payloadcms/db-postgres` (not `db-vercel-postgres`)                                     | proposed            | portable; explicit connection string; not tied to Vercel env names     |
| D4  | Authentication          | Payload's own email/password auth on `Users`                                             | proposed            | no third-party auth needed; sessions and password hashing are built in |
| D5  | Authorisation           | Custom Payload `access` functions + server-action checks                                 | proposed            | collection and field level, never UI-only                              |
| D6  | Media storage           | provider-agnostic seam; vendor chosen in Phase 3                                         | deferred by founder | [§7](#7-media-and-uploads)                                             |
| D7  | Scheduling              | Payload Jobs Queue as source of truth + protected, idempotent runner                     | accepted by founder | [§6](#6-scheduling-and-the-jobs-queue)                                 |
| D8  | Cron cadence            | external free scheduler, five-minute target, no SLA; Vercel stays Hobby, portable to Pro | accepted by founder | [§6.4](#64-verified-vercel-cron-limits-and-the-chosen-approach)        |
| D9  | Timezone                | UTC storage, per-user display timezone, publisher-set default                            | accepted by founder | [§8](#8-time-and-timezones)                                            |
| D10 | Newsletter delivery     | Provider not yet chosen; delivery is **not** claimed                                     | **OPEN**            | [§12](#12-newsletter)                                                  |
| D11 | Hosting                 | Vercel, single project, production branch `main`                                         | accepted by founder | brief §4                                                               |
| D12 | Licence                 | none yet; all rights reserved by default                                                 | **OPEN**            | no `LICENSE` exists today                                              |
| D13 | Manual publish fallback | authorised editors can publish an overdue article through the same guarded task path     | accepted by founder | [§6.3](#63-failure-handling-overdue-detection-and-manual-fallback)     |

---

## 3. Stack, versions and compatibility

Verified against Payload's published requirements on 2026-11-09.

| Layer           | Choice                                                                  | Constraint / note                                                 |
| --------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Runtime         | Node.js 24 LTS pinned in `.nvmrc`, CI and Vercel                        | Payload requires `^22.23.4 \|\| >=24.22.1`                        |     | Framework | Next.js `16.4.5` (App Router) | minimum for CVE-2026-94545 and for the OpenNext Workers adapter; inside Payload's supported `>=16.3.3 <17`; fallback to 15.4.11+ only if a Next 16 incompatibility appears |     | CMS | `payload` `3.93.0` | `@payloadcms/db-postgres` 3.93.0 declares `payload: 3.93.0`, so the family is pinned together. v4 is pre-release only — **do not** adopt it in this build |
| UI runtime      | React `19.2.6`                                                          | template pin, inside Next 16.4.5's peer range (React 19.2.x)      |
| DB adapter      | `@payloadcms/db-postgres`                                               | Drizzle-based; works with any Postgres                            |
| Editor          | Payload Lexical rich text                                               | configured with a restricted feature set (§9)                     |
| Styling         | Tailwind CSS 4 + design tokens                                          | token-driven, no component library dependency tree                |
| Validation      | `zod` for form/API input                                                | shared schemas between client and server                          |
| Images          | `sharp` (Payload upload sizes) + `next/image`                           | no client-side image pipeline                                     |
| Tests           | `vitest`, Payload Local API, `@playwright/test`, `@axe-core/playwright` | [§14](#14-testing-strategy)                                       |
| Lint/format     | ESLint (flat config) + Prettier                                         | enforced in CI                                                    |
| Package manager | npm, single root lockfile                                               | replaces the previous dual `bun.lock` + `package-lock.json` drift |

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

| Limit            | Free                                                                                 | Consequence for us                                                      |
| ---------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Price            | $0/month                                                                             | sufficient for build-out and pre-launch                                 |
| Postgres storage | 1 GB per project (20 GB account-wide)                                                | ample: articles and metadata only, media lives in object storage        |
| Compute          | 100 CU-hours per project per month                                                   | 0.25 CU for ~400 h/month — far above editorial usage                    |
| Branches         | 10 per project                                                                       | main + preview + local dev fits comfortably                             |
| Projects         | 100                                                                                  | one is needed                                                           |
| Scale to zero    | after 5 min idle, cannot be disabled                                                 | first request after idle pays a cold start (typically a few hundred ms) |
| On limit breach  | compute suspends until the next billing period; **no data loss**, no overage billing | must be monitored, and upgraded before launch                           |

**Paid plan (Launch):** usage-based with no minimum fee. Neon's own worked example puts a
0.25 CU compute active 4 h/day at roughly **$3–5/month**. It is **not** enabled, and will not
be enabled, without an explicit cost decision — see [§4.6](#46-cost-governance-and-free-tier-guardrails).

**Founder decision (2026-11-09): stay on the $0 Free plan.** The database lives in the
founder's independently owned Neon account, is connected to Vercel purely through environment
variables, and runs with no paid compute, no paid feature and no automatic upgrade switched
on. Launching and validating the publication comes before any recurring infrastructure cost.

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

### 4.4 Integration path — resolved

**Decision: Neon-managed, in the founder's own Neon account, on the Free plan, wired to
Vercel through environment variables** (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`). No
marketplace-managed billing, no Vercel-managed organisation, no paid add-ons.

This keeps the database independent of the Vercel plan (so Vercel can stay on Hobby), keeps
billing in one place the founder controls, and keeps the Neon console — branches, usage
graphs, alerts — available to us. Preview branching stays under our control rather than being
implied by an integration.

The Vercel Marketplace integration remains available later as a convenience if it ever
reduces work, but it is not part of the design: the application only ever reads the two
connection strings above, so changing how they are delivered is configuration, not code.

### 4.5 Backups and recovery

Neon's instant restore/PITR is a paid-plan capability. Until the plan is upgraded:
a nightly `pg_dump` from a scheduled GitHub Action into encrypted object storage, with a
**quarterly restore drill** recorded in `docs/DEPLOYMENT.md`. A backup that has never been
restored is not a backup. The dump job itself must run inside the free GitHub Actions
allowance, and every candidate for storage must be evaluated for cost before it is enabled.

### 4.6 Cost governance and free-tier guardrails

The operating principle is **minimum recurring infrastructure cost until the publication
earns its keep**: launch and validate first, pay second. Nothing in this rebuild is allowed
to quietly introduce a subscription.

1. **$0 baseline.** Free tier on every provider unless a paid capability is demonstrably
   required by a launched feature, its cost is presented in advance, and the founder
   approves it in writing.
2. **No silent upgrades.** Paid compute sizes, autoscaling, disabling scale-to-zero, PITR,
   extra projects and marketplace "upgrade" prompts stay off. Any pull request that turns
   one on must state the monthly cost and carry explicit approval.
3. **Monitoring before limits.** Usage alerts and a planned response for each free-tier cap
   (§4.2) ship in Phase 1, not after launch.
4. **Graceful degradation, not surprise billing.** If a cap is reached, the public site keeps
   serving cached pages and the admin shows a clear operator message naming the exhausted
   resource and the documented consequence, rather than the architecture escalating to a paid
   tier on its own.
5. **Portability.** Every free-tier dependency is used through a standard interface (a
   Postgres connection string, an S3-compatible API, an HTTP mail API), so changing provider
   or tier is configuration, not a rewrite.

| Guardrail                      | Where                      | Behaviour                                                                               |
| ------------------------------ | -------------------------- | --------------------------------------------------------------------------------------- |
| Compute-hour and storage usage | daily task + `/api/health` | log usage; alert the founder at 70% and 90% of each free-tier cap                       |
| Limit-breach detection         | health check               | operator banner naming the exhausted resource and its documented consequence            |
| Storage growth trend           | weekly task                | DB and media growth reported so the 1 GB cap never arrives unannounced                  |
| Cold-start measurement         | Phase 6 performance pass   | measure; if unacceptable, present the cost of the fix as a decision, never as an action |

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

| Task                         | Queue        | Retries | Purpose                                                           |
| ---------------------------- | ------------ | ------- | ----------------------------------------------------------------- |
| `publishScheduledArticle`    | `publishing` | 3       | publish an article whose scheduled time has passed                |
| `sendSubscriberConfirmation` | `email`      | 3       | double opt-in email (Phase 5)                                     |
| `revalidateContent`          | `default`    | 2       | invalidate cache tags after publish/unpublish                     |
| `sendWorkflowNotification`   | `email`      | 2       | notify editors of submissions/approvals (Phase 5)                 |
| `checkOverduePublishing`     | `publishing` | 1       | flag scheduled articles past their slot and a stale runner (§6.3) |

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

### 6.3 Failure handling, overdue detection and manual fallback

Retries use the task's `retries` setting with exponential backoff. After the final failure:
the article moves to `publish_failed`, the job keeps its error in the admin, a
`workflowEvents` row records `actor: system`, and (Phase 5) the managing editors are
notified. Nothing retries forever, and no failure is silent — the admin dashboard shows a
count of failed jobs, and `/api/health` reports queue depth.

Because the scheduler is external and has no SLA, three further safeguards are part of the
design rather than an afterthought:

- **Overdue detection.** `checkOverduePublishing` runs on the same five-minute cadence and
  lists any article still `scheduled` more than 10 minutes past its slot. The admin shows a
  persistent overdue count with the offending articles, and `/api/health` exposes it. This
  catches the failure a queue cannot see: the scheduler never firing at all.
- **Manual publishing fallback.** A Publisher — or a Managing Editor given the delegated
  capability — can publish a specific overdue article from the admin. It executes the same
  task code path (version pin, guarded transition, unique publication event, audit row with
  the human actor), so the manual route cannot double-publish or release an unapproved
  version.
- **Runner heartbeat.** Every successful scheduler invocation records a timestamp; the admin
  marks the scheduler "stale" when the last heartbeat is older than 15 minutes. An outage is
  visible to editors instead of silent.

### 6.4 Scheduler: verified Vercel limits and the chosen approach

|                           | Hobby                                                        | Pro / Enterprise |
| ------------------------- | ------------------------------------------------------------ | ---------------- |
| Cron jobs per project     | 100                                                          | 100              |
| Minimum interval          | **once per day** — sub-daily expressions fail the deployment | once per minute  |
| Scheduling precision      | anywhere within the scheduled hour (±59 min)                 | per minute       |
| Timezone                  | UTC only                                                     | UTC only         |
| Built-in retries / alerts | none                                                         | none             |

**Founder decision (2026-11-09): external scheduler on the free tier.** Vercel stays on
Hobby; the five-minute trigger comes from outside Vercel. The consequences are stated openly
rather than hidden:

- **No SLA — and it is documented.** The 5–15 minute window is a _target_, not a guarantee.
  If the scheduler is delayed, publication is late; it is never duplicated (§6.2) and always
  visible (§6.3). `docs/DEPLOYMENT.md` and the editorial guide say so explicitly.
- **Not exclusive to GitHub Actions.** GitHub's scheduled workflows are known to be delayed
  or skipped under load, so the architecture requires only "some external service calling one
  URL on a schedule". GitHub Actions is one option; a dedicated cron service, a small
  always-on host, or an uptime monitor's scheduled check are equally valid. The application
  has no knowledge of which is used, and swapping them is a dashboard change.
- **Two endpoints, one secret.** The scheduler calls
  `GET /api/payload-jobs/run?queue=publishing` (which handles schedules too) and optionally
  `GET /api/payload-jobs/handle-schedules`, authenticating with
  `Authorization: Bearer ${CRON_SECRET}` through `jobs.access.run`. A request without it is
  rejected before any job runs.
- **Portable by construction.** Moving to Vercel Pro later means adding one `vercel.json`
  cron entry pointing at the same endpoint and switching the external scheduler off. No
  task, schema, queue or publication-logic change is involved — the trigger is the only
  moving part.
- **Observable.** Heartbeat, overdue and queue-depth signals (§6.3) mean a scheduler outage
  surfaces in the admin within fifteen minutes instead of being discovered by an editor
  wondering why the morning story never went live.

---

## 7. Media and uploads

Vercel has no persistent filesystem, so production media must live in object storage. v1
keeps the storage vendor **out of the architecture**: no provider is a hard dependency.

- The application talks to one Payload upload collection; the storage adapter is selected by
  configuration (`MEDIA_STORAGE_ADAPTER`), so the article model, templates, SEO tags and URL
  building are identical whichever vendor is used.
- Local development uses the filesystem adapter. Production requires a cloud adapter and
  refuses to start with the local one.
- **Decision deferred to Phase 3** by founder instruction, when the two candidates are
  compared on: total cost at realistic volume, delivery performance and CDN behaviour,
  quality of Payload integration, upload limits (Payload documents a 4.5 MB server-upload
  limit on Vercel, mitigated by client-side uploads), image optimisation and transform
  support, backup and durability story, and operational complexity.
  - Candidate A — **Vercel Blob** (`@payloadcms/storage-vercel-blob`): one vendor, one bill.
  - Candidate B — **Cloudflare R2** (`@payloadcms/storage-s3` against an R2 endpoint):
    cheaper egress at scale, a second vendor. Payload's `storage-r2` adapter is Workers-only
    and is _not_ the right package for this deployment.

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

| Collection          | Purpose                                                                 | Notable fields                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `articles`          | all editorial content                                                   | title, slug, dek, section (rel), format (rel), authors (rel, ordered), tags (rel), heroMedia (rel), body (Lexical), status, scheduledFor, publishedAt, updatedAt, isExclusive, exclusivityRationale, opinionDisclaimer, seo group, versions(drafts) |
| `sections`          | Latest/News, Celebrity, Film & TV, Music, Culture, Exclusives, Features | name, slug, description, seo, order, isPublic                                                                                                                                                                                                       |
| `formats`           | Breaking, News, Exclusive, Interview, Feature, Analysis, Opinion        | name, slug, rules copy, requiresRationale flag                                                                                                                                                                                                      |
| `authors`           | bylines / contributors                                                  | name, slug, role, bio, avatar, socials, isStaff                                                                                                                                                                                                     |
| `tags`              | topic taxonomy                                                          | name, slug, description                                                                                                                                                                                                                             |
| `media`             | images and documents                                                    | file, alt, caption, credit, licence, licenceNotes, focalPoint                                                                                                                                                                                       |
| `users`             | staff accounts                                                          | email, password, name, roles[], timezone, active                                                                                                                                                                                                    |
| `corrections`       | corrections and clarifications                                          | article (rel), type, summary, correctedAt, approvedBy, isPublic                                                                                                                                                                                     |
| `subscribers`       | newsletter list                                                         | email (unique), status, consentedAt, consentSource, unsubscribeToken, tags[]                                                                                                                                                                        |
| `workflowEvents`    | immutable audit log                                                     | article, actor, fromStatus, toStatus, note, jobId, createdAt                                                                                                                                                                                        |
| `publicationEvents` | publish/unpublish record + dedupe                                       | article, version, publishedAt, actor, unique(article, version)                                                                                                                                                                                      |

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

| Capability                       | Contributor | Writer | Editor       | Managing Editor | Publisher | Administrator |
| -------------------------------- | ----------- | ------ | ------------ | --------------- | --------- | ------------- |
| Create/edit own draft            | ✅          | ✅     | ✅           | ✅              | ✅        | ✅            |
| Edit others' drafts              | —           | —      | ✅           | ✅              | ✅        | ✅            |
| Submit for review                | —           | ✅     | ✅           | ✅              | ✅        | ✅            |
| Request changes / approve        | —           | —      | —            | ✅              | ✅        | ✅            |
| Schedule publication             | —           | —      | —            | —               | ✅        | ✅            |
| Publish / unpublish              | —           | —      | —            | —               | ✅        | ✅            |
| Manage sections, tags, formats   | —           | —      | —            | ✅              | ✅        | ✅            |
| Manage users and roles           | —           | —      | —            | —               | —         | ✅            |
| Manage subscribers / corrections | —           | —      | —            | ✅              | ✅        | ✅            |
| Read audit log                   | —           | —      | own articles | ✅              | ✅        | ✅            |

Rules that follow from the brief: a Writer never receives publishing rights implicitly;
promotion is an explicit role change by an Administrator; every check runs on the server
(Payload access + server actions), and the UI merely reflects the result. Deleting is
soft (unpublish + archive) for anyone below Administrator.

**Security controls** (Phase 4 exit criteria): session cookie `HttpOnly`/`Secure`/
`SameSite=Lax`, CSRF protection on mutations, rate limiting on login and newsletter
endpoints (database-backed, no extra service), constant-time secret comparison,
no account enumeration in password reset, and every admin action written to
`workflowEvents`.

**Verified locally on 2026-11-09** (Payload 3.93.0, Next 16.4.5, Postgres 18): Payload's own auth
stores `salt` plus an 81-character PBKDF2 `hash` and never plaintext, and keeps `login_attempts`
and `lock_until` for lockout; a wrong password returns `401`, and first-register closes itself
once the first account exists (`403`). Cookie sessions are honoured **only** when the request's
`Origin` matches `serverURL` — otherwise Payload quietly treats the request as anonymous, on `GET`
as well as on mutations. That is why `/api/users/me` answers `200` with `{ user: null }` and
`/api/users` answers `403` from a bare `curl`: it is a CSRF/Origin rule, not a broken session.
Bearer-token requests (the jobs scheduler) are unaffected. Any test or tooling that exercises
cookie auth must send `Origin`.

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

| Level       | Tool                                                    | Scope                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | vitest                                                  | date/timezone helpers, slugging, permission predicates, SEO builders, validation schemas                                                                                                                         |
| Integration | vitest + Payload Local API against a throwaway Postgres | every access rule for every role; every workflow transition including illegal ones; publish idempotency (double-run the task, assert one publication); unauthenticated REST requests return 401/403 with no data |
| E2E         | Playwright + axe                                        | the 20-step publishing script from the brief, run against a seeded app with its own database branch                                                                                                              |
| CI          | GitHub Actions                                          | install → format check → lint → typecheck → unit → integration → build, on every PR and every push to `main`                                                                                                     |

The 20-step manual script becomes `tests/e2e/publishing.spec.ts`, with steps 11–16 covering
public visibility, correction, unpublish, and the guarantee that a draft URL 404s for a
signed-out visitor.

Integration tests run against a real Postgres (Neon branch or `postgres:16` service in CI),
not SQLite — Postgres-specific behaviour is part of what we are testing.

---

## 15. Environments and secrets

| Environment | App                                 | Database                              | Purpose                    |
| ----------- | ----------------------------------- | ------------------------------------- | -------------------------- |
| Local       | `next dev` on the developer machine | Neon `dev` branch (or local Postgres) | development, fixtures only |
| Preview     | every PR, Vercel preview deployment | **its own Neon branch**               | review, E2E, editorial QA  |
| Production  | `main`, Vercel production           | Neon `main` branch                    | public site                |

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
MEDIA_STORAGE_ADAPTER      # Phase 3: local | vercel-blob | s3 — no vendor hard dependency
BLOB_READ_WRITE_TOKEN      # only if the Phase 3 decision is Vercel Blob
S3_ENDPOINT                # only if the Phase 3 decision is R2/S3
S3_BUCKET                  # only if the Phase 3 decision is R2/S3
S3_ACCESS_KEY_ID           # only if the Phase 3 decision is R2/S3
S3_SECRET_ACCESS_KEY       # only if the Phase 3 decision is R2/S3
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
- **No paid plan is enabled by this design.** Vercel stays on Hobby, Neon stays on Free, and
  any tier change is a cost decision with written approval (§4.6).
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

| Item                                | Finding                                                                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default branch                      | `master`                                                                                                                                                                                     |
| CI trigger                          | `.github/workflows/tests.yml` — `push: branches: [master]` + all PRs                                                                                                                         |
| Other `master` references in repo   | `TRUST_RELEASE.md:15` only                                                                                                                                                                   |
| Vercel config in repo               | `lumiere-the-index-codebase/vercel.json` (old frontend, not root)                                                                                                                            |
| Lovable coupling                    | 11 files (`lumiere-the-index-codebase/AGENTS.md`, `vite.config.ts`, `__root.tsx`, `apiClient.ts`, `lovable-error-reporting.ts`, `package.json`, `bunfig.toml`, `.gitignore`, both lockfiles) |
| Branch protection / secret scanning | not visible from here — founder console action                                                                                                                                               |

### 18.3 `master` → `main` migration, ordered

This is a remote, hard-to-reverse change, so it happens in one planned window **after**
the new baseline exists and is green — not now.

1. **Gate 0 — Lovable disconnected and verified, before any baseline commit.** The founder
   disconnects the Lovable project (or revokes its GitHub App write access); then, in order:
   a. **Integrations checked** — GitHub _Settings → GitHub Apps_ and installed integrations:
   nothing retains write access to this repository except the intended accounts.
   b. **No unexpected pushes** — re-read `refs/heads/*` on the remote, compare with the known
   list (22 branches on 2026-11-09), and watch for bot commits after a no-op commit.
   c. **Working tree and branch state verified** — `git status`, `git branch -vv`, and the
   remote/default-branch pointers recorded before and after.
   d. **Legacy recovery confirmed remotely** — `git ls-remote origin legacy/index-beta2`
   returns `bd26e72…`, and `refs/heads/master` is still `bd26e72…`.
   e. **Only then** is the new baseline commit created.
   History is never deleted, and the default branch is never overwritten, without explicit
   founder approval: the rebuild lands on a branch first.
2. **Gate 1 — new code lands on a branch** (`phase-1/foundation`) as a draft PR. `master`
   stays untouched and deployable throughout.
3. **Gate 2 — new CI is proven** on that PR: format, lint, typecheck, unit, integration,
   build all green. The old workflow file is replaced in the same PR (it targets a `backend/`
   directory that no longer exists).
4. **Gate 3 — Vercel is pointed at the new project first.** Either a new Vercel project
   whose Production Branch is `main`, or the existing project's Production Branch updated in
   the same window. Critically: the old project's automatic production deploys from `master`
   are disabled, so a stale `master` cannot serve the retired app or a half-migrated tree.
5. **Gate 4 — rename.** GitHub _Settings → Branches → rename `master` to `main`_. This
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

| #   | Decision                                                    | Recommendation                                                                                     | Needed by                  |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------- |
| O1  | ~~Neon integration path~~                                   | **Resolved:** Neon-managed, founder-owned account, Free plan, env-var connection, no paid features | done                       |
| O2  | ~~Cron cadence~~                                            | **Resolved:** external scheduler, five-minute target, no SLA, Vercel stays Hobby, portable to Pro  | done                       |
| O3  | ~~Media storage~~                                           | **Resolved:** deferred to Phase 3 behind a provider-agnostic seam                                  | Phase 3                    |
| O10 | ~~Cost policy~~                                             | **Resolved:** $0 recurring baseline; any paid tier needs a written cost decision                   | done                       |
| O4  | Newsletter provider                                         | Resend (defer to Phase 5)                                                                          | Phase 5                    |
| O5  | `LICENSE` / rights statement                                | private, all rights reserved                                                                       | before first public commit |
| O6  | Default branch rename window (`master` → `main`)            | after CI green, before launch                                                                      | Phase 1/7 boundary         |
| O7  | Lovable disconnect                                          | disconnect before baseline commit                                                                  | Phase 1                    |
| O8  | Production URL canonical host (`lumiereindex.com` vs `www`) | apex canonical, `www` 301                                                                          | Phase 5                    |
| O9  | Editorial timezone seed value                               | founder sets `publicationTimezone`                                                                 | Phase 3                    |

---

## 20. Phases and exit criteria

| Phase | Deliverable                                                                                                  | Exit criteria                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1     | Foundation: baseline commit, repo docs, `.env.example`, strict TS/ESLint/Prettier, Next+Payload scaffold, CI | `npm run lint`, `typecheck`, `test`, `build` all green in CI on a branch; admin loads locally against the dev database |
| 2     | Design system and public pages against fixtures                                                              | all 14 routes render, responsive, axe clean on key pages, Lighthouse ≥ 90 on a fixture article                         |
| 3     | CMS, media, auth                                                                                             | articles/media/authors/sections work end to end; uploads carry licence; login and password reset work                  |
| 4     | Roles, workflow, scheduling                                                                                  | capability matrix enforced in integration tests; scheduled publish fires once; failed job surfaces in admin            |
| 5     | SEO, RSS, newsletter                                                                                         | only published content indexed; sitemap/RSS valid; double opt-in and unsubscribe verified with a real inbox            |
| 6     | Testing                                                                                                      | the 20-step script passes as Playwright E2E; unauthorised API access rejected; a11y and performance budgets met        |
| 7     | Production prep                                                                                              | backups + restore drill, env docs, smoke checklist, DNS plan — **deployment only with explicit approval**              |

Dependencies: 2 and 3 both need 1; 4 needs 3; 5 needs 4; 6 spans 2–5; 7 needs all.

---

## 21. Risks

| Risk                                                 | Impact                               | Mitigation                                                                                                          |
| ---------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Payload/Next version incompatibility                 | build blocked                        | pin to the verified ranges; no v4 pre-releases; upgrade only behind a preview deploy                                |
| Next 16 cache/Cache Components friction with Payload | subtle staleness                     | keep cacheComponents off initially; tag-based revalidation with explicit tests                                      |
| External scheduler delayed or skipped                | late publication                     | five-minute target documented as no-SLA; overdue detection, runner heartbeat and manual publish fallback (§6.3)     |
| Neon Free compute suspension at the monthly cap      | admin read/write failure             | usage tracking and alerts at 70/90% (§4.6), documented breach behaviour, cost decision escalated before any upgrade |
| Cold starts after scale-to-zero                      | first-request latency                | measure in Phase 6; disable scale-to-zero on paid plan if it matters                                                |
| Unlicensed imagery                                   | legal exposure                       | licence field is mandatory and validated; no legacy assets reused                                                   |
| Branch rename or Vercel misconfiguration             | production serving stale/broken code | the gated order in §18.3, done in one window                                                                        |
| Lovable re-syncing the old app                       | work overwritten                     | Gate 0 disconnect before baseline                                                                                   |
| Single-maintainer bus factor                         | delivery risk                        | docs-first, no tribal knowledge, everything reproducible from the repo                                              |
| No backups exist today                               | data loss                            | nightly dump + restore drill before launch                                                                          |
