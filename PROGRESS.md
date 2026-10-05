# Daloyra — Progress

## Status

| Phase                                | State                                                              |
| ------------------------------------ | ------------------------------------------------------------------ |
| 0 — Foundations                      | Code done; waiting on owner: Vercel connection + network allowlist |
| 1 — Accounts and tenancy             | Not started                                                        |
| 2 — App shell and people             | Not started                                                        |
| 3 — Sales and collecting             | Not started                                                        |
| 4 — Purchases, expenses, other money | Not started                                                        |
| 5 — Dashboard and history            | Not started                                                        |
| 6 — Reports                          | Not started                                                        |
| 7 — Hardening and launch             | Not started                                                        |

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

D1–D14 were proposed to the owner and applied by default; the owner may still change any of them.

## Environment notes

- Supabase dev project ref: `rthblabylzscojupghle` (`https://rthblabylzscojupghle.supabase.co`).
- The cloud sandbox network blocks `api.supabase.com`, `*.supabase.co`, `api.vercel.com` and
  `ui.shadcn.com` until they are added to the environment's allowed domains.

## Phase 0 — try it yourself

1. Open the Vercel link (after the Vercel setup steps).
2. On your phone, check the landing page shows "Know where your money flows." with a teal
   "Start free trial" button and a "Log in" button.
3. Those buttons lead to "not found" pages for now. That is expected; they arrive in Phase 1.
