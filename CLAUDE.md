@AGENTS.md

# Daloyra — working rules for Claude

`SPEC.md` is the source of truth. `PROGRESS.md` records phase status and every decision
the spec left open. Read both before starting work.

## Process

- One phase at a time (SPEC §14). At the end of a phase: `npm run check` and `npm run build`
  green, `PROGRESS.md` updated, a "try it yourself" checklist for the owner, a commit, then stop
  for approval.
- The owner is not a developer. Manual steps get numbered, click-by-click instructions; never
  assume a manual step was done.
- Do not build anything in SPEC §2.3 "Later".
- Check current docs before using an API (Next.js docs ship in `node_modules/next/dist/docs/`).
  Next.js 16: request interception is `src/proxy.ts` (not `middleware`). Supabase keys are
  "publishable" (`sb_publishable_…`) and "secret" (`sb_secret_…`).

## Never trade away

1. **Tenant isolation** (SPEC §6).
2. **Money accuracy** (SPEC §3).

If a shortcut weakens either, don't take it.

## Money rules (SPEC §3)

- Amounts `numeric(14,2)`, quantities `numeric(12,3)`. Never float/real/double.
- Every stored total and every aggregate is computed in PostgreSQL (triggers, generated columns,
  functions, views). The browser never computes a number that gets saved.
- TypeScript: amounts are **strings** at the boundary. `decimal.js` (via `src/lib/money.ts`) only
  for live form previews. No arithmetic on JS `number` for money.
- Rounding half-up to 2 decimals, per line item. Display with `formatMoney` (Intl, business
  currency) and the `amount` utility class (tabular numbers).
- Payment status (Paid / Partially Paid / Unpaid) and balances are **derived** from non-voided
  payments, never stored as input. Overpayment is blocked in the DB with a row lock on the parent.
- Void, never delete, money records. Voided rows are excluded from every total. Voiding a
  sale/purchase voids its payments in the same transaction.
- Every create/edit/void writes the audit log (trigger-written, append-only).
- The client generates record UUIDs so retries cannot create duplicates.
- Transaction dates are SQL `date` in the business timezone (default `Asia/Manila`). "Today" is
  computed server-side in that timezone (`src/lib/dates.ts`). Weeks start Monday.
- Payment methods: one shared list in `src/lib/payment-methods.ts`, matching the DB CHECK.
- PostgREST returns `numeric` as a JSON number, so read amounts with a `::text` cast in the select
  (`amount:amount::text`) and pass amounts to Postgres functions as decimal strings (`text`
  parameters validated and cast inside the function).

## Tenant isolation (SPEC §6)

- Every business-owned table has `business_id uuid not null`, `unique (business_id, id)`, and an
  index led by `business_id`.
- RLS enabled on **every** `public` table. Access only via `business_members`, through helpers in
  the unexposed `private` schema (`security definer`, `search_path = ''`).
- Child rows use composite FKs `(business_id, x_id)` so they cannot point across tenants.
- Views are `security_invoker = true`. No DELETE policy on money tables.
- Policies are role-aware (owner / manager / staff) from day one; app checks go through
  `can(role, action)` in `src/lib/permissions.ts`.
- The current business is resolved on the server from membership. Never trust a `business_id`
  sent by the browser on its own.
- `src/lib/supabase/admin.ts` (secret key, bypasses RLS) is `server-only` and reserved for the
  Phase 8 admin area. Never use it for business data.
- Database changes only via files in `supabase/migrations/`. Never edit the hosted DB by hand.
- Every new table gets isolation tests in `supabase/tests/` (pgTAP). The generic checks in
  `00_schema_guards` and `01_tenant_isolation` cover new tables automatically; add table-specific
  cases too. Tests run in CI (`npx supabase start` + `npx supabase test db`).
- Grant table privileges explicitly in each migration: `revoke all … from anon, authenticated`, then
  grant only what the policies need (column-level `update (…)` where only some columns may change).
- Write policies use `private.my_writable_business_ids(roles)` (excludes suspended businesses);
  read policies use `private.my_business_ids(roles)`. Postgres functions raise short message keys
  (`business_already_exists`) that actions map to `copy.ts` text.

## Code conventions (SPEC §13)

- TypeScript strict, no `any`. Server Components by default; Client Components only for
  interactivity.
- Feature code in `src/features/<domain>/` (`schema.ts` Zod, `queries.ts`, `actions.ts`,
  `components/`). One Zod schema per form, shared by client and server.
- Server Actions re-check the session, validate with Zod, call a Postgres function, and return
  `{ ok, error }` — never throw raw DB errors to the user.
- All UI text in `src/lib/copy.ts`. Plain words (Money In/Out, Amount to Collect/Pay, Profit).
- Design tokens are CSS variables in `src/app/globals.css`; use Tailwind token classes
  (`bg-primary`, `text-money-in`, `rounded-card` …), not raw hex.
- Mobile first: usable at 360 px, touch targets ≥ 44 px, amount inputs use `inputMode="decimal"`.
- Regenerate `src/types/database.ts` after every migration with `npm run db:types` (set
  `SUPABASE_DB_URL` when not using the local Supabase); never hand-edit it. CI fails if it is stale.
- shadcn/ui components live in `src/components/ui/`. The shadcn registry is blocked in the cloud
  sandbox, so add components by writing their source when needed.

## Commands

`npm run dev` · `npm run check` (lint + typecheck + unit tests) · `npm run build` ·
`npm run format` · `npm run test:e2e` (in the cloud sandbox set
`CHROMIUM_PATH=/opt/pw-browsers/chromium`) · `npm run db:test` and `npm run db:types` (need a
local Supabase, or `SUPABASE_DB_URL`).
