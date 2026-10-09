# Daloyra — Progress

## Status

| Phase                                | State                                     |
| ------------------------------------ | ----------------------------------------- |
| 0 — Foundations                      | Done — live at https://daloyra.vercel.app |
| 1 — Accounts and tenancy             | Built — waiting for owner check           |
| 2 — App shell and people             | Not started                               |
| 3 — Sales and collecting             | Not started                               |
| 4 — Purchases, expenses, other money | Not started                               |
| 5 — Dashboard and history            | Not started                               |
| 6 — Reports                          | Not started                               |
| 7 — Hardening and launch             | Not started                               |

## Phase 0 — what exists

- Next.js 16.3 (App Router, TypeScript strict, `src/` dir), Tailwind 4, shadcn/ui setup
  (`components.json`, `Button`), lucide icons.
- Fonts: Plus Jakarta Sans (headings) and Inter (body) via `next/font`.
- Design tokens from SPEC §12 as CSS variables in `src/app/globals.css`.
- Supabase clients: `src/lib/supabase/client.ts` (browser), `server.ts` (server, user session),
  `admin.ts` (server-only, secret key, Phase 8), `proxy.ts` (session refresh).
- `src/proxy.ts`: refreshes the Supabase session and sets a per-request nonce
  Content-Security-Policy. Static security headers in `next.config.ts`.
- Helpers with unit tests: `src/lib/money.ts`, `src/lib/dates.ts`; shared
  `src/lib/payment-methods.ts`; UI text in `src/lib/copy.ts`.
- Tooling: ESLint, Prettier, Vitest (18 tests), Playwright (landing check on a phone viewport).
- `supabase/` initialised (`config.toml`: email confirmation on, 8-character password minimum).
- GitHub Actions CI: lint, format check, typecheck, unit tests and build on every push.

## Phase 1 — what exists

- **Database** (`supabase/migrations/`):
  - `profiles` (created by a trigger on signup, email kept in sync), `businesses`,
    `business_members`, `business_counters`, `plans` (trial plan seeded), `subscriptions`,
    `platform_admins`, `audit_logs`.
  - `private` schema helpers `my_business_ids(roles)` and `my_writable_business_ids(roles)` (the
    second skips suspended businesses); RLS on every table; explicit, narrow table grants (signed-out
    visitors have none; the owner may update only listed business columns, never `status`).
  - `create_business(...)`: verified email required, one business per account, client-chosen id
    so a retry returns the same business; creates owner membership, S/P counters and a 14-day trial.
  - Generic audit trigger `private.audit_row()` (create / update / void), attached to `businesses`.
  - Private `logos` storage bucket (PNG/JPG/WebP, 2 MB) with files under `{business_id}/`.
- **Database tests** (`supabase/tests/`, pgTAP, 74 checks): schema guards (RLS on every table,
  security-invoker views, no anon grants, no deletes, no floats, `business_id` rules, pinned
  `search_path`), tenant isolation A vs B (reads, inserts, updates, deletes, takeover, storage,
  signed-out), and accounts/business rules (validation, idempotency, roles, suspension, audit log).
  They run in a new CI job against a throwaway local Supabase, which also fails if
  `src/types/database.ts` is out of date.
- **App**: `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/auth/confirm` (handles
  both email-link styles), `/onboarding` (3-step wizard with logo upload), a protected `(app)`
  layout (requires a business; suspended businesses see a notice) and a placeholder `/dashboard`.
  `src/proxy.ts` redirects signed-out visitors to log in and signed-in users away from log in /
  sign up; layouts and actions re-check on the server.
- `src/lib/permissions.ts` (`can(role, action)`), `src/lib/routes.ts` (safe `next` redirects),
  `src/lib/image-type.ts` (logo bytes are checked, not just the file name); 44 unit tests, 3 e2e.

## Decisions (where the spec was silent or changed)

| #   | Decision                                                                                                                                                       | Reason                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| D1  | The Cash Balance card means all money on hand (cash + e-wallets + bank); its info text says so. Card and cheque movements count on their payment date.         | Spec §3.5 / §17.10; the real fix is the later multiple-accounts feature. |
| D2  | Purchases count against Profit on the purchase date (no stock/COGS); the Profit info text says so.                                                             | Spec §3.4; inventory is "Later".                                         |
| D3  | Movements dated before `starting_balance_date` count in Profit but not in Cash Balance; forms warn when back-dating before it.                                 | Spec silent.                                                             |
| D4  | Any sale/purchase with a balance > 0 requires a customer/supplier (not only "Not yet").                                                                        | Prevents debts no one can collect.                                       |
| D5  | Payments are voided (with a reason) and re-recorded, never edited. A payment date cannot be before its document date.                                          | Spec silent; keeps the audit trail simple.                               |
| D6  | Currency is locked once any money record exists.                                                                                                               | There is no currency conversion.                                         |
| D7  | Loan interest is recorded as an expense; the Other Money form hints at this.                                                                                   | Otherwise interest never reduces Profit.                                 |
| D8  | The reference-number counter skips numbers already used.                                                                                                       | Spec §2.1 #8 allows manual edits, which could otherwise collide.         |
| D9  | `customer_payments.customer_id` / `supplier_payments.supplier_id` are trigger-maintained from the parent document.                                             | Avoids mismatched copies.                                                |
| D10 | SELECT policies are role-aware: owner/manager see all rows, staff see only rows they created.                                                                  | Spec §8 "own entries only"; the §6.2 example would leak profit to staff. |
| D11 | Suspended status is enforced inside the shared private helper used by write policies.                                                                          | One place to get right.                                                  |
| D12 | The audit log is per document; a sale's entry snapshots its items.                                                                                             | Readable history.                                                        |
| D13 | CSV export prefixes cells starting with `=`, `+`, `-`, `@` to stop formula injection.                                                                          | Security.                                                                |
| D14 | "Due soon" = due today through today + 7 days.                                                                                                                 | Spec ambiguous at the boundary.                                          |
| D15 | Next.js 16 uses `proxy.ts`; Supabase uses publishable/secret keys (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`).                             | Current docs (spec rule 0.4).                                            |
| D16 | CSP uses a per-request nonce, so every page renders dynamically (the root layout reads headers). Inline styles are allowed for chart/library style attributes. | Static pages cannot carry a nonce.                                       |
| D17 | The owner works without local Node and tries each phase on Vercel previews. Database tests will run in GitHub Actions against a temporary local Supabase.      | The owner is not a developer; the cloud sandbox has no Docker.           |

| D18 | The trial plan is seeded by a migration (every environment needs it). Paid plans are added when their prices are decided (Phase 8). | Spec §13 put plans in `seed.sql`, which never runs in production. |
| D19 | `create_business` needs a verified email, allows one business per account, and returns the existing business when retried with the same id. | Spec §6.3, §17.2, §3.6. |
| D20 | Business settings (including starting cash) are owner-only and audited; `status` can only be changed by the platform, never from the app. | Spec §8; starting cash changes the Cash Balance. |
| D21 | Logos live in a private bucket and are shown through 1-hour signed links; SVG is not accepted, and the file's bytes are checked. | SVG can carry scripts; spec §6.3 path rule. |
| D22 | Amounts travel as decimal strings: Postgres functions take `text` amounts and validate them; reads cast `numeric` to text. | PostgREST turns `numeric` into JSON numbers (floats). |
| D23 | Default expense categories are added to `create_business` in Phase 2, with a backfill for businesses created before then. | The categories table arrives in Phase 2. |
| D24 | Database tests use pgTAP and run in GitHub Actions on every push (local Supabase); the hosted project is never used for tests. | D17; keeps test data out of the hosted database. |
| D25 | Login errors never reveal whether an email is registered; sign-up and password reset show the same message either way. | Account privacy. |

D1–D14 were proposed to the owner and applied by default; the owner may still change any of them.

## Environment notes

- Supabase dev project ref: `rthblabylzscojupghle` (`https://rthblabylzscojupghle.supabase.co`).
- Vercel project `daloyra`: https://daloyra.vercel.app (Production currently deploys from branch `claude/daloyra-build-spec-dyputg`). Both public Supabase variables are set for all environments.
- The cloud sandbox network blocks `api.supabase.com`, `*.supabase.co`, `api.vercel.com` and
  `ui.shadcn.com` until they are added to the environment's allowed domains.

## Phase 1 — setup on Supabase (needed before trying it)

1. **Database migrations: done** (applied 9 Oct 2026). The cloud sandbox cannot open direct
   database connections, so they were applied through the Supabase Management API (one
   transaction per file) and recorded in `supabase_migrations.schema_migrations`, so
   `supabase db push` sees them as applied.
2. **Allowed links.** Supabase dashboard → project _Daloyra-dev_ → **Authentication** → **URL
   Configuration**:
   - _Site URL_: `https://daloyra.vercel.app`
   - _Redirect URLs_ → **Add URL** for each: `https://daloyra.vercel.app/**`,
     `https://*.vercel.app/**` (Vercel previews), `http://localhost:3000/**`. Click **Save**.
3. **Email links that work on any phone** (recommended). **Authentication** → **Emails** →
   **Templates**:
   - _Confirm signup_: in the message body, replace `{{ .ConfirmationURL }}` with
     `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` and click **Save**.
   - _Reset password_: replace `{{ .ConfirmationURL }}` with
     `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery` and click **Save**.

   Without this step the links still work, but only in the same browser that asked for them.

4. Supabase's built-in email sender allows only a few emails per hour. If an email does not
   arrive, wait an hour (a custom sender is set up in Phase 7).

## Phase 1 — try it yourself

Use the Vercel preview link for branch `claude/vigilant-meitner-pidrdu` (Vercel → project
_daloyra_ → **Deployments** → the newest one for that branch → **Visit**).

1. On your phone, tap **Start free trial**. Tap **Create account** with everything empty: each
   field says what to fix.
2. Sign up with your real email and a password of 8+ characters. You see "Check your email".
3. Open the email and tap the link. You land on **Set up your business**.
4. Step 1: enter a business name and choose a type → **Next**. Step 2: add a logo (a PNG or JPG
   photo) → **Next**. Step 3: type `1500.50` as starting cash; it shows ₱1,500.50 →
   **Finish setup**.
5. You see "Welcome to …" with your business name and logo at the top.
6. Tap **Log out**, then open `/dashboard` directly: you are sent to **Log in**.
7. Log in with a wrong password: "Email or password is incorrect." Then log in correctly: you
   are back on the dashboard (not the setup wizard).
8. Log out → **Forgot password?** → enter your email → open the email link → choose a new
   password → you land on the dashboard. Log out and log in with the new password.
9. With a second email address (or ask a friend), create a second account and business. Each
   account sees only its own business name and logo. The automated tests check the rest.
10. On GitHub → **Actions**, the newest **CI** run shows two green jobs, including **Database
    tests (RLS, tenant isolation, money rules)**.

## Phase 0 — try it yourself

1. Open the Vercel link (after the Vercel setup steps).
2. On your phone, check the landing page shows "Know where your money flows." with a teal
   "Start free trial" button and a "Log in" button.
3. Those buttons lead to "not found" pages for now. That is expected; they arrive in Phase 1.
