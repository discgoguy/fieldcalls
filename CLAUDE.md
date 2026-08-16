# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow: research → change → document

The knowledge base at [`.claude/knowledge-base/`](.claude/knowledge-base/) is the
source of truth for how this codebase works. Follow this loop for every change — a
change isn't done until the knowledge base reflects it.

### 1. Before changing code — research first

1. Read [`.claude/knowledge-base/README.md`](.claude/knowledge-base/README.md) — the
   index; it explains the stack and layout and links the topic docs.
2. Read the KB file(s) matching your task:
   - Routing, boot, page system, `/api` → `architecture.md`
   - Entity factory, data access, DB types → `data-layer.md`
   - Login, roles, permissions, RLS → `auth-and-permissions.md`
   - Schema, migrations, seed, local Supabase → `database-and-migrations.md`
   - Anything CRM → `crm-module.md`
   - How to add a page/table/entity, gotchas → `conventions.md`
3. Then read the actual code the docs point to and confirm current behavior. The
   docs are a map, not a substitute — verify a file/function/column still exists
   before relying on it. **If docs and code disagree, the code wins** (and the doc
   is stale — fix it in step 3).
4. If the subsystem you're touching has no KB coverage, writing it is part of the task.

### 2. While changing code

- Follow the patterns in `conventions.md` (add-a-page, add-a-table/entity, data
  access via the entity factory, server-only work in `/api`).
- Match the surrounding code's style and naming.
- **Keep comments concise.** Comment the *why* (a non-obvious constraint, gotcha, or
  decision), not the *what* — don't narrate what the code plainly says. Prefer a short
  line or two over a paragraph; if a rule needs a long explanation, put it in the
  knowledge base and reference it rather than inlining an essay.
- Respect the recorded gotchas (see below and `conventions.md`).
- **Any UI change: work out the mobile layout too** — see
  [Mobile is not optional](#mobile-is-not-optional) below. This is not a follow-up
  task; a desktop-only layout is an unfinished one.
- Run `npm run typecheck` and `npm run lint` before considering code done.

### 3. After changing code — update the knowledge base

Reconcile `.claude/knowledge-base/` with what you changed. **Editing existing docs
is preferred over adding new ones** — keep it a tight, non-duplicative set.

- Changed how an existing subsystem works → **edit** the matching file; update
  prose/tables/examples and delete lines the change made false (don't just append).
- Added functionality that fits an existing doc's scope → **edit** that doc.
- Added a whole new feature area with no home → **create**
  `.claude/knowledge-base/<feature>.md` and add a row linking it in the table in
  `README.md`.
- Found a new gotcha, or one the docs got wrong → update `conventions.md`.

Ground every claim in code you actually read (real files/functions/columns, no
invented behavior). Keep docs skimmable; if you deferred something, say so.

## Commands

```bash
npm run dev         # Vite dev server
npm run build       # production build (vite build)
npm run lint        # eslint .   (run before finishing)
npm run lint:fix    # eslint --fix
npm run typecheck   # tsc --noEmit   (run before finishing)
npm test            # vitest run   (unit tests)
npm run test:watch  # vitest (watch mode)
```

Running the app requires a database — local Supabase (below) for dev. (The old
`VITE_MOCK` in-memory mode was removed; it's preserved on the `temp/crm-mock-mode`
branch if ever needed again.)

Testing is **minimal and pure-logic only** (Vitest, node environment, config in
`vitest.config.ts`; that config sets placeholder `VITE_SUPABASE_*` env values so
modules importing `supabaseClient` don't throw at load). Tests sit next to their
subject as `*.test.ts` — currently `src/pages/crmDashboard.logic.ts` (CRM Overview
KPI math), `src/pages/deals.logic.ts` (kanban grouping/totals),
`src/components/crm/crmUtils.ts` (shared CRM helpers) and
`src/lib/urlFilters.logic.ts` (URL filter serialize/clamp/clear for `useUrlFilters`).
There are **no
component/DOM or integration tests**. To keep UI logic testable, extract it into a
pure `*.logic.ts` module and unit-test that (the component imports it). Also verify
via `typecheck`, `lint`, and running the app against local Supabase.

### Local database (Supabase CLI + Colima)

```bash
colima start && supabase start        # boot local Supabase in Docker
supabase status                        # print local URLs/keys (Studio :54323, DB :54322)
supabase migration up --local          # apply pending migrations (no data loss) — preferred
supabase db reset                      # DROP the DB, replay all migrations, run seed.sql
supabase gen types typescript --local > src/api/database.types.ts   # after schema changes
```

⚠️ `supabase db reset` wipes the whole local DB **including `auth.users`**. `seed.sql`
then recreates one local admin login (**alex@fieldcalls.com / password123** — local-only,
known dev password) so you're not locked out, but any other users are gone. Use
`migration up` for incremental changes.

## Architecture (big picture)

React 18 SPA (Vite) talking **directly to Supabase** (Postgres + RLS + Auth +
Storage) via a thin entity factory, plus Vercel serverless functions in `/api` for
server-only work. Security is enforced by **Postgres Row-Level Security, not the
client** — client permission checks are UX only.

- **Routing is config-driven and flat.** `src/pages.config.js` maps `"PageKey" →
  Component`; `src/App.jsx` turns each into a top-level `/PageKey` route wrapped in
  `src/Layout.jsx`. Build links with `createPageUrl(name)` (`src/utils/index.ts`),
  which lowercases+hyphenates; detail pages read `?id=` from the query string.
  **To add a page you must edit `pages.config.js`.**
- **All DB access goes through the entity factory** `makeEntity(table)` in
  `src/api/entities.ts` (`list/get/filter/create/bulkCreate/update/delete`; `filter`
  has an eq / IN / `$gte`-operator / `null` mini-DSL). Don't call
  `supabase.from(...)` directly (auth/profile reads are the only exceptions). Types
  flow from the **generated** `src/api/database.types.ts`.
- **Auth:** `src/lib/AuthContext.jsx` holds session + a merged `profiles` user
  object; roles are `profiles.role` (`admin`/`technician`/`customer`).
  `src/lib/usePermissions.js` adds finer UI gating via a `roles`/`role_id` table.
- **Server-only work** (email, PDFs, privileged user management, trusted mutations)
  lives in `/api/*` and is called with `invokeApi(name, payload)` from
  `src/api/supabaseClient.ts`. Anything needing a secret/service-role key goes here.
- **Database:** `supabase/schema.sql` is the idempotent full schema for fresh
  installs; `supabase/migrations/` are incremental, run-once changes. **New changes
  go in a NEW migration file AND are mirrored into `schema.sql`** — never re-copy
  `schema.sql` over the initial migration (breaks fresh resets). Data-only backfills
  are migration-only.

## Mobile is not optional

This app is used on phones. **Every UI addition or change must state what it does at
mobile width**, in the same pass as the desktop layout — not as a follow-up. If you
can't say what a new component looks like at 375px, it isn't done.

**Know your real width budget.** Don't eyeball it, compute it. The chrome is fixed and
measurable:

| Layer | Cost |
|---|---|
| `<main>` padding (`Layout.jsx`) | `p-4` mobile → 32px, `sm:p-6` → 48, `lg:p-8` → 64 |
| Sidebar (`Layout.jsx`) | `w-64` = 256px, and it takes **real layout space from `lg`** (`lg:relative`); below that it's an overlay costing nothing |
| `CardContent` | `p-6` = 48px, at every breakpoint |
| shadcn table cells | `TableCell p-2` / `TableHead px-2` = 16px per cell |

So a card on a 375px phone leaves **~295px** of usable content width (~293 inside a
bordered box), and a two-column
split at `lg` would give each side only ~320px — which is why the CRM map/table split
starts at `xl`, not `lg`. Do this arithmetic, put it in a comment, and re-do it if you
change a breakpoint.

**Checklist for any new UI:**

- **Tables:** drop columns by breakpoint (`hidden sm:table-cell`) rather than letting
  the table overflow. Never truncate a *number* — shed a column or truncate a label
  instead. Fold anything dropped into a remaining cell so no information is lost.
- **`truncate` doesn't truncate without a width constraint.** In a table cell it needs a
  `max-w-*` wrapper (a nowrap block otherwise contributes its full text width as the
  cell's min-content width and widens the table); in a flex row the truncating child
  needs `min-w-0` and its siblings `shrink-0`.
- **Fixed heights stack up.** A 420px scroll box under a 360px map leaves a phone with
  no page. Cap heights per breakpoint.
- **Overflow:** `<main>` carries `overflow-x-hidden`, so anything wider than the
  viewport is **clipped and unreachable** unless it has its own scrollport. Give wide
  content `overflow-auto` deliberately, and never let a cap truncate data silently —
  say what was dropped.
- **z-index:** prefer `isolate` on the container over a bigger number. Ties are broken
  by DOM order, so equal z-indexes mean "whatever comes later wins" — that's how a
  sticky table header ended up painting over an open filter menu.
- **Touch targets** are real `<button>`s with accessible names, not clickable `<div>`s.

**Reference implementations:** `src/components/crm/MapFilterBar.tsx` (chips collapse to
one button + a bottom sheet below `sm`) and `src/components/crm/MapTable.tsx` (columns
collapse per breakpoint, width caps derived arithmetically). `crm-module.md` records the
reasoning for both.

Verification is manual — there are **no component/DOM tests** (see below), so
`typecheck`/`lint`/`vitest` prove nothing about layout. Check the real thing in a
narrow viewport, and if you haven't, **say so** rather than implying it was verified.

## TypeScript

Mid-migration: data layer and all CRM code are `.ts`/`.tsx` and `strict`; legacy
pages are `.jsx` and unchecked (`checkJs: false`). New code should be TypeScript.
Regenerate `database.types.ts` after any schema change so column/table references
stay type-checked.

## Gotchas (see `.claude/knowledge-base/conventions.md` for the full list)

- `supabase db reset` deletes all users (local).
- Don't handle the `TOKEN_REFRESHED` auth event — it fires on tab refocus and
  remounts the current page.
- The `categories` table does **not** exist in the schema, but a `Category` entity
  and a legacy page reference it.
- The legacy `customers` table is load-bearing (quotes/tickets FK to it) and only
  loosely bridged to the newer CRM `crm_companies`/`crm_contacts` — tread carefully
  around account/contact consolidation.
