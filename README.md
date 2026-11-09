# Lumière Index

**News that matters.**

An entertainment and culture publication from **Lumiere Media and Entertainment
Technologies**. This repository holds the publication, its CMS and its editorial workflow.

> **Status: Phase 1 — foundation.** The site is not live, nothing here is indexed, and no
> reporting has been published. The previous product in this repository (a film and TV
> ranking index) was retired; its history is preserved and recoverable at the
> `legacy/index-beta2` tag and branch.

## Stack

| Layer      | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router)                                      |
| CMS        | Payload 3, embedded in the same Next.js app                  |
| Database   | PostgreSQL (Neon in hosted environments)                     |
| Language   | TypeScript, strict                                           |
| Styling    | CSS now; the editorial design system lands in Phase 2        |
| Deployment | Vercel today, portable by design; Cloudflare is under review |

## Requirements

- Node.js `>=24.22.1` (see `.nvmrc`)
- npm 11+
- A PostgreSQL database for local development (any Postgres works; Neon's free plan is what
  hosted environments use)

## Local setup

```bash
npm install
cp .env.example .env.local      # then fill DATABASE_URL, DATABASE_URL_UNPOOLED, PAYLOAD_SECRET
npm run dev
```

The public holding page is at `/`, the CMS console at `/admin`. On a fresh database the
first visit to `/admin` creates the first administrator account.

`PAYLOAD_SECRET` must be at least 32 random bytes, for example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Commands

| Command                      | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `npm run dev`                | Development server with Turbopack                 |
| `npm run build`              | Production build                                  |
| `npm run start`              | Serve a production build                          |
| `npm run lint`               | ESLint                                            |
| `npm run typecheck`          | `tsc --noEmit`                                    |
| `npm run format`             | Prettier, write                                   |
| `npm run format:check`       | Prettier, check only (what CI runs)               |
| `npm run generate:types`     | Regenerate `src/payload-types.ts` from the config |
| `npm run generate:importmap` | Regenerate the admin import map                   |

## Layout

```text
src/app/(frontend)/   public routes
src/app/(payload)/    CMS admin and Payload REST/GraphQL routes
src/collections/      Payload collections
src/payload.config.ts Payload configuration (Postgres adapter, editor, collections)
docs/                 architecture and operational documentation
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the approved design: stack, data model,
  roles, workflow, scheduling, environments, deployment and the branch migration plan.

## Branches and releases

`main` is the only long-lived branch. Work happens on `feature/...` or `phase-.../...`
branches and merges by pull request; commit messages follow Conventional Commits. Production
deployment requires explicit approval and is not part of ordinary development work.

## Licence

No licence file is present. All rights are reserved pending a decision on terms.
