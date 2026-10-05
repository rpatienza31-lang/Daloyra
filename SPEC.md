# Daloyra — Build Specification

**Simple accounting and business tracking for small business owners.**
Spec version 1.1 · October 2026 · Default market: Philippines (₱, Asia/Manila)

> Decisions made where this spec was silent, or where it was adjusted, are recorded in
> `PROGRESS.md` under "Decisions".

---

## 0. Instructions to Claude Code (read first)

You are the lead engineer, product designer and architect for Daloyra. This file is the source of truth. Where it is silent, choose the simplest option that keeps the data correct and tenants isolated, and note the choice in `PROGRESS.md`.

**About the product owner.** The owner runs businesses and is not a developer. When a step needs them (creating a Supabase project, copying keys, connecting Vercel), give numbered, click-by-click instructions and wait for confirmation. Never assume a manual step was done.

**Working rules**

1. **Plan before code.** Before writing anything, read this whole file, then reply with: (a) a short summary of what you will build, (b) anything in the spec you think is wrong, risky or contradictory, (c) the Phase 0 plan. Wait for approval.
2. **One phase at a time.** Phases are in Section 14. At the end of each phase: run lint, typecheck and tests; update `PROGRESS.md`; give the owner a short "how to try it" checklist; stop and wait for approval.
3. **Stay in scope.** Do not build anything listed under "Later" (Section 2.3). You may prepare the schema for it only where this spec says so.
4. **Check current docs.** Use the latest stable versions of Next.js, Supabase and `@supabase/ssr`, and follow their current documentation for auth, cookies, API key naming and file conventions (for example whether request interception lives in `middleware` or `proxy`). Do not rely on remembered API shapes.
5. **Database changes only through migration files** in `supabase/migrations/`. Never edit the database by hand in the dashboard.
6. **Two rules that are never traded away:** tenant isolation (Section 6) and money accuracy (Section 3). If a shortcut weakens either, do not take it.
7. Create `CLAUDE.md` in Phase 0 containing the conventions from Sections 3, 6 and 13 so they persist across sessions.
8. Commit at the end of every phase with a clear message.

---

## 1. Product summary

Daloyra (from the Filipino word _daloy_, "flow") lets a small business owner record sales, purchases, expenses and payments in a few taps, and see at a glance: how much they sold, how much they spent, what profit they made, how much cash they have, who owes them, and whom they owe.

- **Users:** owners of small shops, food stalls, online sellers, service providers. Most have no accounting training.
- **Business model:** paid SaaS. Many businesses use the same application; each has a private workspace. No business can ever see another's data.
- **Promise:** record a sale or expense in under 15 seconds, on a phone.

---

## 2. Product decisions (analysis already done)

### 2.1 Improvements to the original feature list

| #   | Decision                                                                                                                                                                                                                                                | Why                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Payments are their own records.** A sale or purchase has a total; payments against it are separate rows. "Paid / Partially Paid / Unpaid" is _calculated_ from payments, never typed in and stored separately.                                        | One source of truth. Receivables, payables, payment history and cash flow all come from the same rows and cannot disagree.                         |
| 2   | **"Credit" means Credit Card, and it is a payment method.** Payment methods are: Cash, GCash, Maya, Online Bank, Credit Card, Cheque, Other. A customer who will pay later (utang) is not a method; it is a sale marked "Not yet paid" with a due date. | Mixing "how they paid" with "whether they paid" creates contradictory records.                                                                     |
| 2a  | **Payment method is a category on every money movement.** Every payment, expense and other money entry records how it was paid. Users can filter any list by method and see totals per method on the dashboard and in a dedicated report.               | Owners need to know how much came in as cash versus GCash, bank or card, and to match those totals against their wallet, bank and card statements. |
| 3   | **Profit and cash are shown as two different things**, each with a one-line plain-language explanation.                                                                                                                                                 | A business can be profitable and still out of cash. This is the most common confusion for beginners.                                               |
| 4   | **Add "Other Money In / Out"** (owner put money in, owner took money out, loan received, loan repayment, other). These change cash but not profit.                                                                                                      | Without it, the cash balance in the app drifts away from the real cash drawer within days.                                                         |
| 5   | **Quick entry first.** A sale can be saved with only an amount; date, customer (Walk-in), method (Cash) and status (Paid) are pre-filled. Multiple line items are optional.                                                                             | The "few steps" requirement.                                                                                                                       |
| 6   | **Void instead of delete** for all money records, with a reason. Voided records stay visible in history and are excluded from every total.                                                                                                              | Audit safety; mistakes are recoverable.                                                                                                            |
| 7   | **Dates are business-local calendar dates**, not UTC timestamps.                                                                                                                                                                                        | "Sales Today" must mean today in Manila, not in London.                                                                                            |
| 8   | **Reference numbers auto-generate** per business (S-0001, P-0001), editable.                                                                                                                                                                            | Speed, and no duplicates.                                                                                                                          |
| 9   | **CSV export and print-friendly reports are in the MVP.** Excel and designed PDFs come later.                                                                                                                                                           | Cheap to build, and owners need to hand numbers to their bookkeeper.                                                                               |
| 10  | **Tenant-isolation test suite is a launch requirement**, not an optional extra.                                                                                                                                                                         | It is the main promise made to paying clients.                                                                                                     |

### 2.2 MVP scope

- Sign up, login, logout, forgot/reset password, email verification
- Onboarding: business profile with logo, currency (default PHP), starting cash balance
- Dashboard with summary cards, charts and period filter
- Sales (quick and multi-item), customer payments, To Collect (receivables)
- Purchases, supplier payments, To Pay (payables)
- Expenses with default and custom categories
- Other Money In / Out
- Customers and Suppliers with totals, balances and payment history
- Payment method (Cash, GCash, Maya, Online Bank, Credit Card, Cheque, Other) on every money movement, with filtering and totals per method
- Transaction history: search, filter, sort, view, edit, void
- Ten reports with date filter, CSV export, print view
- Settings: business profile, categories, account
- Audit log recorded for every money record (viewer can be simple)
- Owner role in the UI; schema and security rules ready for Manager and Staff
- Subscription tables present, every business on a trial plan, no billing UI

### 2.3 Later (do not build now)

Admin dashboard and plan management (Phase 8, right after MVP) · staff invitations and role-limited UI · online payment for subscriptions · Excel/PDF export · invoice and receipt generation · multiple money accounts (cash drawer, GCash wallet, bank) with transfers · VAT and BIR reports · inventory, POS, barcode · recurring transactions · receipt photo upload and AI scanning · notifications and payment reminders · unpaid expenses (bills) · one payment spread across several invoices · multiple branches · multiple businesses per account · Filipino language · mobile app · bank reconciliation · payroll.

---

## 3. Money rules (the accounting source of truth)

These definitions are binding. Implement them once, in the database, and reuse them everywhere.

### 3.1 Storage and arithmetic

- Amounts: `numeric(14,2)`. Quantities: `numeric(12,3)`. Never `float`, `real` or `double precision`.
- **All stored totals and all aggregates are computed in PostgreSQL.** The browser never computes a number that gets saved.
- In TypeScript, treat amounts as strings at the boundary and use `decimal.js` for live form previews only. No arithmetic on JS `number` for money.
- Rounding: half-up to 2 decimals, applied per line item.
- Display: `Intl.NumberFormat` with the business currency, e.g. `₱1,234.50`.

### 3.2 Document totals

- `line_total = round(quantity × unit_price, 2)` (generated column)
- `subtotal = Σ line_total`
- `total = subtotal − discount_amount`, with `0 ≤ discount_amount ≤ subtotal`
- Same for purchases using `unit_cost`.
- Enforced by database triggers and constraints so they hold no matter which code path writes.

### 3.3 Payment status (derived, never stored as user input)

For a sale or purchase with `total` and `amount_paid = Σ non-voided payments`:

- **Paid:** `amount_paid = total`
- **Partially Paid:** `0 < amount_paid < total`
- **Unpaid:** `amount_paid = 0`
- `balance = total − amount_paid`. A payment may never exceed the remaining balance (enforced in the database with a row lock on the parent document).

Due status when `balance > 0`: **Overdue** (due date before today), **Due soon** (within 7 days), **Not yet due**, **No due date**.

### 3.4 Period figures (filtered by the selected date range)

All exclude voided records.

| Figure        | Definition                                                                              |
| ------------- | --------------------------------------------------------------------------------------- |
| Sales         | Σ `sales.total` where `sale_date` in range                                              |
| Purchases     | Σ `purchases.total` where `purchase_date` in range                                      |
| Expenses      | Σ `expenses.amount` where `expense_date` in range                                       |
| **Profit**    | **Sales − Purchases − Expenses** (counted by transaction date, whether or not paid yet) |
| Money In      | Σ customer payments + Σ other money in, by payment/entry date                           |
| Money Out     | Σ supplier payments + Σ expenses + Σ other money out, by date                           |
| Net cash flow | Money In − Money Out                                                                    |

Expenses are always treated as paid on the day they are recorded.

### 3.5 Point-in-time figures (not affected by the period filter)

- **Cash Balance** = starting cash balance + all Money In − all Money Out, from `starting_balance_date` up to today.
- **Amount to Collect** = Σ `balance` of all non-voided sales.
- **Amount to Pay** = Σ `balance` of all non-voided purchases.

### 3.6 Edit and void rules

- Editing a sale or purchase cannot reduce its total below what has already been paid.
- Voiding a sale or purchase voids its payments in the same database transaction (confirm with the user first, showing the amounts affected).
- Every create, edit and void is written to the audit log with before and after values.
- Double-submit protection: the client generates the record UUID, so a retried request cannot create a duplicate.

### 3.7 Payment method breakdown

- Every row in `customer_payments`, `supplier_payments`, `expenses` and `cash_adjustments` has a required `method`.
- A sale or purchase itself has no method; its payments do. One sale can therefore be paid partly in cash and partly by GCash, and each part is counted under its own method.
- **Money In by method** = customer payments + other money in, grouped by `method`, for the selected period. **Money Out by method** = supplier payments + expenses + other money out, grouped by `method`.
- The per-method figures must always add up exactly to total Money In and total Money Out for the same period.
- Unpaid amounts have no method and appear only under Amount to Collect / Amount to Pay.
- This is a breakdown of movements, not a separate balance per wallet or bank account (that is the later "multiple money accounts" feature).

### 3.8 Dates and periods

- Transaction dates use the SQL `date` type and mean the calendar date in the business timezone (`businesses.timezone`, default `Asia/Manila`).
- "Today" is always computed in the business timezone, on the server.
- Weeks start on Monday. Filters: Today, This week, This month, This year, Custom range.

---

## 4. Technology stack

| Layer                | Choice                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Framework            | Next.js (App Router), React, TypeScript in strict mode                                                                                 |
| Styling              | Tailwind CSS + shadcn/ui components + lucide-react icons                                                                               |
| Data                 | Supabase: PostgreSQL, Auth, Storage (logos)                                                                                            |
| Supabase client      | `@supabase/ssr` with cookie-based sessions                                                                                             |
| Forms and validation | react-hook-form + Zod (same schema on client and server)                                                                               |
| Charts               | Recharts (via shadcn chart components)                                                                                                 |
| Tables               | TanStack Table                                                                                                                         |
| Money and dates      | decimal.js, date-fns (+ timezone helper)                                                                                               |
| Tests                | Vitest (unit), database integration tests for security and money rules, one Playwright smoke test                                      |
| Hosting              | Vercel (app), Supabase (database)                                                                                                      |
| Email                | Supabase default sender during development; custom SMTP (for example Resend) before launch, because the default sender is rate-limited |

**Environments:** two Supabase projects, `daloyra-dev` and `daloyra-prod`. Migrations are applied with the Supabase CLI. Use the hosted dev project by default so the owner does not need Docker; use local Supabase only if Docker is already installed.

---

## 5. System architecture

```
Browser (phone or desktop)
   │
   ▼
Next.js on Vercel
   ├─ Server Components ── read data (user's session, RLS applies)
   ├─ Server Actions ───── validate with Zod → call Postgres functions
   └─ Admin routes ─────── server-only, secret key, metadata only (Phase 8)
   │
   ▼
Supabase
   ├─ Auth ──────── users, sessions, email verification, password reset
   ├─ PostgreSQL ── tables + Row Level Security + triggers + functions + views
   └─ Storage ───── business logos (later: receipt photos)
```

Principles:

- **The database is the guard.** Row Level Security decides what a user can touch. Application code filters by `business_id` as well, but security never depends on the application remembering to.
- **Reads** go through Server Components using the user's session. Dashboards and reports call Postgres functions/views that aggregate in SQL.
- **Writes** go through Server Actions that validate input and call a Postgres function, so a sale, its items and its first payment are saved atomically (all or nothing).
- **The secret/service key** exists only in server-only code for the admin area. It is never imported by anything that reaches the browser.
- **Current business** is resolved on the server from the user's membership. A `business_id` sent by the browser is never trusted on its own.

---

## 6. Multi-tenancy and security

### 6.1 How separation works

1. Every business is a row in `businesses`. Every business-owned table has `business_id uuid not null`.
2. `business_members` links users to businesses with a role. This is the only thing that grants access.
3. Row Level Security is enabled on **every** table in the `public` schema. A table with no policy returns nothing.
4. Policies allow a row only if its `business_id` is one of the caller's businesses.
5. Child rows cannot point across tenants: use composite foreign keys, for example `sales (business_id, customer_id)` references `customers (business_id, id)`.
6. Views are created with `security_invoker = true` so RLS still applies through them.

### 6.2 Policy pattern (illustrative — confirm against current Supabase guidance)

```sql
create schema if not exists private;  -- not exposed through the API

create or replace function private.my_business_ids(allowed_roles text[] default null)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  where m.user_id = (select auth.uid())
    and (allowed_roles is null or m.role = any (allowed_roles));
$$;

alter table public.sales enable row level security;

create policy sales_select on public.sales for select to authenticated
  using (business_id in (select private.my_business_ids()));

create policy sales_insert on public.sales for insert to authenticated
  with check (business_id in (select private.my_business_ids(array['owner','manager','staff'])));

create policy sales_update on public.sales for update to authenticated
  using      (business_id in (select private.my_business_ids(array['owner','manager'])))
  with check (business_id in (select private.my_business_ids(array['owner','manager'])));

-- No DELETE policy on money tables: records are voided, not deleted.
```

Index `business_id` on every table (usually as the first column of a composite index with the date).

### 6.3 Security checklist

- RLS enabled and tested on every table; storage bucket policies restrict files to the path `{business_id}/...`.
- Automated tenant-isolation tests (Section 15) pass before any deploy.
- Every Server Action re-validates input with Zod and re-checks the session.
- New businesses are created only through a `create_business` function that inserts the business, owner membership, default categories, counters and trial subscription in one transaction.
- `audit_logs` is append-only: written by triggers, readable by the owner, with no update or delete policy.
- Email verification required before using the app; sensible password minimum; Supabase rate limits left on.
- Secrets only in environment variables; `.env*` in `.gitignore`; `.env.example` committed.
- Security headers set (CSP, frame-ancestors, referrer policy).
- Suspended businesses (`businesses.status = 'suspended'`) are blocked at the app layout and in write policies.
- Admin area (Phase 8): separate `platform_admins` table, server-only access, shows names, emails, plan, status and counts only — never transactions, customers or amounts. Every admin action is logged.
- Backups: enable Supabase backups on the production project before the first paying client.
- Privacy: provide Privacy Policy and Terms pages and a way to export or delete a business's data on request (Philippine Data Privacy Act).

---

## 7. Database schema

**Conventions for all tables:** `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz` (trigger-maintained). Business-owned tables add `business_id` and `unique (business_id, id)`. Money tables add `created_by`, `updated_by`, `voided_at`, `voided_by`, `void_reason`. Fixed option lists are `text` with `CHECK` constraints.

### 7.1 Identity and tenancy

| Table               | Key columns                                                                                                                                                                                                                                                    | Notes                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `profiles`          | `id` (= `auth.users.id`), `full_name`, `email`                                                                                                                                                                                                                 | Created by trigger on signup            |
| `businesses`        | `name`, `owner_name`, `business_type`, `address`, `contact_number`, `email`, `currency_code` (default `PHP`), `timezone` (default `Asia/Manila`), `logo_path`, `starting_cash_balance`, `starting_balance_date`, `status` (`active`/`suspended`), `created_by` | The tenant                              |
| `business_members`  | `business_id`, `user_id`, `role` (`owner`/`manager`/`staff`), `unique (business_id, user_id)`                                                                                                                                                                  | Grants access                           |
| `business_counters` | `business_id`, `kind` (`sale`/`purchase`), `next_value`                                                                                                                                                                                                        | Reference number generation, row-locked |
| `platform_admins`   | `user_id`                                                                                                                                                                                                                                                      | No client-side policies at all          |

### 7.2 People and categories

| Table                | Key columns                                                       | Notes                                                                                                                           |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `customers`          | `name`, `phone`, `email`, `address`, `notes`, `archived_at`       | Totals and balances come from views, not stored                                                                                 |
| `suppliers`          | same shape as customers                                           |                                                                                                                                 |
| `expense_categories` | `name`, `is_default`, `archived_at`, `unique (business_id, name)` | Seeded per business: Rent, Utilities, Salaries/Wages, Transportation, Supplies, Marketing, Internet, Maintenance, Miscellaneous |

Customers, suppliers and categories that are in use are archived, never deleted.

### 7.3 Money records

| Table               | Key columns                                                                                                                           | Notes                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `sales`             | `customer_id` (nullable = Walk-in), `sale_date`, `reference_no`, `subtotal`, `discount_amount`, `total`, `due_date`, `notes`          | `unique (business_id, reference_no)`; totals maintained by trigger |
| `sale_items`        | `sale_id`, `description`, `quantity`, `unit_price`, `line_total` (generated), `position`                                              | Add nullable `product_id` later for inventory                      |
| `customer_payments` | `sale_id`, `customer_id`, `payment_date`, `amount` (> 0), `method`, `reference`, `notes`                                              | Overpayment blocked by trigger                                     |
| `purchases`         | `supplier_id` (nullable), `purchase_date`, `reference_no`, `subtotal`, `discount_amount`, `total`, `due_date`, `notes`                | Mirror of sales                                                    |
| `purchase_items`    | `purchase_id`, `description`, `quantity`, `unit_cost`, `line_total` (generated), `position`                                           |                                                                    |
| `supplier_payments` | `purchase_id`, `supplier_id`, `payment_date`, `amount`, `method`, `reference`, `notes`                                                |                                                                    |
| `expenses`          | `category_id`, `expense_date`, `description`, `amount` (> 0), `method`, `notes`                                                       |                                                                    |
| `cash_adjustments`  | `entry_date`, `direction` (`in`/`out`), `type` (`owner_in`, `owner_out`, `loan_in`, `loan_out`, `other`), `amount`, `method`, `notes` | "Other Money In / Out"; affects cash, not profit                   |

Payment `method` values and their labels (required, `NOT NULL`, default `cash`):

| Value           | Label shown to users |
| --------------- | -------------------- |
| `cash`          | Cash                 |
| `gcash`         | GCash                |
| `maya`          | Maya                 |
| `bank_transfer` | Online Bank          |
| `card`          | Credit Card          |
| `cheque`        | Cheque               |
| `other`         | Other                |

Keep the list in one shared constant (value, label, icon, color) used by forms, filters, pills, charts and reports. Index `(business_id, method)` on the four tables that carry a method.

### 7.4 Platform

| Table           | Key columns                                                                                                                                 | Notes                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `plans`         | `code` (`trial`/`basic`/`pro`/`premium`), `name`, `price_monthly`, `limits jsonb`, `is_active`                                              | `limits` example: `{"transactions_per_month": 300, "members": 1, "exports": false}` |
| `subscriptions` | `business_id` (unique), `plan_id`, `status` (`trialing`/`active`/`past_due`/`canceled`/`expired`), `trial_ends_at`, `current_period_end`    | Created with the business                                                           |
| `audit_logs`    | `business_id`, `table_name`, `record_id`, `action` (`create`/`update`/`void`), `old_data jsonb`, `new_data jsonb`, `actor_id`, `created_at` | Trigger-written, append-only                                                        |

### 7.5 Views and functions (all `security_invoker`)

- `sales_overview`, `purchases_overview`: document + `amount_paid`, `balance`, `payment_status`, `due_status`.
- `customer_summary`, `supplier_summary`: total sales/purchases, total paid, outstanding balance.
- `transactions_feed`: one unified list (sale, purchase, expense, customer payment, supplier payment, other money in/out) with `type`, `date`, `party`, `description`, `money_in`, `money_out`, `status`.
- `get_dashboard(business_id, from, to)`: every card value in Section 3.4 and 3.5 in one call.
- `get_monthly_series(business_id, months)`: sales, purchases, expenses, profit per month.
- `get_daily_series(business_id, from, to)`: sales per day.
- `get_money_by_method(business_id, from, to)`: Money In, Money Out and net per payment method (Section 3.7).
- `create_business(...)`, `create_sale(payload)`, `update_sale(payload)`, `void_sale(id, reason)`, and the purchase equivalents; `record_customer_payment`, `record_supplier_payment`.

### 7.6 Relationships

```
auth.users 1─1 profiles
profiles   1─* business_members *─1 businesses
businesses 1─* customers, suppliers, expense_categories, sales, purchases,
               expenses, cash_adjustments, audit_logs
businesses 1─1 subscriptions *─1 plans
customers  1─* sales 1─* sale_items
                sales 1─* customer_payments
suppliers  1─* purchases 1─* purchase_items
                purchases 1─* supplier_payments
expense_categories 1─* expenses
```

---

## 8. Roles and permissions

| Capability                                  | Owner | Manager         | Staff                 |
| ------------------------------------------- | ----- | --------------- | --------------------- |
| Record sales, expenses, purchases, payments | Yes   | Yes             | Yes                   |
| Edit and void money records                 | Yes   | Yes             | No                    |
| Customers and suppliers                     | Yes   | Yes             | View and add          |
| Dashboard profit and cash, reports          | Yes   | Yes             | No (own entries only) |
| Business settings, categories               | Yes   | Categories only | No                    |
| Team, subscription, audit log               | Yes   | No              | No                    |

MVP ships the Owner experience only. Write RLS policies role-aware from day one, and put permission checks behind one helper (`can(role, action)`) so Manager and Staff can be switched on later without touching every page. **Application Admin** is not a business role; it lives in `platform_admins`.

---

## 9. Main user flows

1. **Sign up → verify email → onboarding.** Three short steps: (1) business name, owner name, type; (2) contact details and logo, all optional; (3) currency (₱ preselected) and starting cash with the helper text "How much cash does your business have right now? You can change this later." Then land on the dashboard.
2. **First-time dashboard.** Friendly empty state with three buttons: Record a sale, Record an expense, Add a customer.
3. **Record a sale (quick).** Tap "+ New" → Sale → type amount → Save. Optional: description, customer, more items, discount, date. Under "Did they pay?" choose Paid in full (default) / Paid part / Not yet. When any amount is paid, "How did they pay?" shows one-tap chips: Cash (default) · GCash · Maya · Online Bank · Credit Card · More (Cheque, Other). "Paid part" asks the amount received; "Not yet" hides the method chips, asks for an optional due date and requires a customer.
4. **Collect a payment.** To Collect page → tap a row → "Record payment" → amount pre-filled with the balance → Save.
5. **Record an expense.** "+ New" → Expense → amount → category → Save.
6. **Record a purchase / pay a supplier.** Mirror of flows 3 and 4.
7. **Fix a mistake.** Transactions → open record → Edit, or Void with a reason.
8. **Check performance.** Dashboard period filter, or Reports → choose report → choose dates → Export CSV or Print.

---

## 10. Pages and routes

| Area       | Route                                                                       | Purpose                                                                                                             |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Public     | `/`                                                                         | Simple landing page with Log in and Start free trial                                                                |
| Auth       | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/confirm` | Authentication                                                                                                      |
| Onboarding | `/onboarding`                                                               | Business setup wizard                                                                                               |
| App        | `/dashboard`                                                                | Cards, charts, period filter, recent activity                                                                       |
|            | `/sales`, `/sales/new`, `/sales/[id]`                                       | List, create, detail with payments                                                                                  |
|            | `/purchases`, `/purchases/new`, `/purchases/[id]`                           | Same for purchases                                                                                                  |
|            | `/expenses`                                                                 | List; create and edit in a side sheet                                                                               |
|            | `/money`                                                                    | Other Money In / Out                                                                                                |
|            | `/customers`, `/customers/[id]`                                             | List; profile with sales, balance, payment history                                                                  |
|            | `/suppliers`, `/suppliers/[id]`                                             | Same for suppliers                                                                                                  |
|            | `/receivables`                                                              | "To Collect": customer, invoice, original, paid, balance, due date, status                                          |
|            | `/payables`                                                                 | "To Pay": supplier, reference, original, paid, balance, due date, status                                            |
|            | `/transactions`                                                             | Unified history: search, filters (type, date, payment method, status, customer/supplier), sorting, view, edit, void |
|            | `/reports`, `/reports/[type]`                                               | Report index and individual reports                                                                                 |
|            | `/settings/business`, `/settings/categories`, `/settings/account`           | Settings (Team and Plan tabs appear later)                                                                          |
| Admin      | `/admin/*`                                                                  | Phase 8 only                                                                                                        |

**Dashboard layout**

- Always-current cards: Sales Today · Cash Balance · Amount to Collect · Amount to Pay
- Period cards (follow the filter, default This month): Sales · Purchases · Expenses · Profit
- Charts: (1) Sales vs Purchases vs Expenses by month, last 12 months; (2) Profit by month; (3) Sales trend by day for the selected period
- "How money came in" panel: Money In per payment method for the selected period (horizontal bars with amount and percentage), with a toggle to Money Out
- Recent transactions (last 8) and "Overdue to collect" (top 5)

Payment method also appears as a small pill on every payment, expense and transaction row, and as a filter on the Sales, Purchases, Expenses and Transactions lists.

**Reports:** Sales · Purchases · Expenses (by category) · Profit and Loss Summary · Cash Flow Summary · Payment Method Summary (Money In, Money Out and net per method, with drill-down to the transactions behind each figure) · To Collect · To Pay · Sales by Customer · Purchases by Supplier. Each has a date filter, totals row, CSV export and print stylesheet with the business name and logo.

---

## 11. UX rules and wording

- Use plain words in the interface. Keep technical terms out of labels; show the formal term only as small secondary text where a bookkeeper might look for it.

| Use this                                         | Not this                           |
| ------------------------------------------------ | ---------------------------------- |
| Money In / Money Out                             | Inflows / Outflows, Debit / Credit |
| Amount to Collect                                | Accounts Receivable                |
| Amount to Pay                                    | Accounts Payable                   |
| Profit                                           | Net Income                         |
| Did they pay? Paid in full / Paid part / Not yet | Payment status                     |
| Cancel this record (Void)                        | Reverse entry                      |

- Defaults do the work: date = today, customer = Walk-in, method = Cash, status = Paid.
- Mobile first. Every flow must be comfortable one-handed at 360 px wide. Amount fields open the numeric keypad.
- One primary action per screen. Destructive actions need a confirmation that states the consequence in numbers.
- Every empty state explains what the page is for and offers one button.
- Small info icons explain Profit, Cash Balance, To Collect and To Pay in one sentence each.
- Show positive and negative with sign and label as well as color.
- Loading skeletons, success toasts, and inline form errors written as instructions ("Enter an amount greater than 0").
- Keep all interface text in one place (`src/lib/copy.ts` or similar) so Filipino can be added later.

---

## 12. Design system

**Feel:** calm, clear, premium, spacious. It should look like a modern finance app, not accounting software.

| Token                         | Value                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Primary (brand, "river teal") | `#0F6B74`, hover `#0B555C`, tint `#E6F2F3`                                                             |
| Text                          | `#0F172A` primary, `#475569` secondary, `#94A3B8` muted                                                |
| Background / surface / border | `#F7F8FA` / `#FFFFFF` / `#E5E7EB`                                                                      |
| Money In, positive            | `#16A34A`                                                                                              |
| Money Out, negative           | `#DC2626`                                                                                              |
| Warning, due soon             | `#D97706`                                                                                              |
| Fonts                         | Plus Jakarta Sans for headings, Inter for body, loaded with `next/font`; `tabular-nums` on all amounts |
| Type scale                    | 12 / 14 / 16 / 20 / 24 / 32 px; card figures 24–28 px semibold                                         |
| Radius                        | cards 16 px, inputs and buttons 10 px, pills full                                                      |
| Spacing                       | 4 px grid; card padding 20–24 px; page gutter 16 px mobile, 32 px desktop                              |
| Elevation                     | hairline border plus very soft shadow; no heavy shadows                                                |

Define these as CSS variables so a dark theme can be added later (not in MVP).

**Layout**

- Desktop: fixed left sidebar (240 px) grouped as Overview (Dashboard) · Money In (Sales, To Collect) · Money Out (Purchases, Expenses, To Pay) · People (Customers, Suppliers) · Insights (Transactions, Reports) · Settings. Top bar with business name and logo, period filter where relevant, and a "+ New" button.
- Mobile: bottom bar with Home · Sales · **+** · Expenses · More. The "+" opens a sheet: Sale, Expense, Purchase, Payment received, Payment made, Other money in/out.
- Tables become stacked cards under 768 px. Touch targets at least 44 px.
- Status pills: Paid (green), Partially Paid (amber), Unpaid (gray), Overdue (red), Voided (muted, struck through).

Accessibility: WCAG AA contrast, visible focus rings, labels on every input, full keyboard navigation.

---

## 13. Folder structure and code conventions

```
daloyra/
├─ CLAUDE.md  SPEC.md  PROGRESS.md  .env.example
├─ supabase/
│  ├─ migrations/           # numbered SQL files, the only way schema changes
│  ├─ seed.sql              # plans + demo business for development
│  └─ tests/                # tenant isolation and money-rule tests
└─ src/
   ├─ app/
   │  ├─ (marketing)/       # landing, privacy, terms
   │  ├─ (auth)/            # login, signup, forgot-password, reset-password
   │  ├─ auth/confirm/      # email link handler
   │  ├─ onboarding/
   │  ├─ (app)/             # protected shell: dashboard, sales, purchases, ...
   │  └─ (admin)/admin/     # Phase 8
   ├─ features/             # one folder per domain
   │  └─ sales/             # schema.ts (Zod), queries.ts, actions.ts, components/
   ├─ components/           # ui/ (shadcn), layout/, charts/, data-table/, forms/
   ├─ lib/
   │  ├─ supabase/          # client.ts, server.ts, admin.ts (server-only)
   │  ├─ money.ts  dates.ts  permissions.ts  entitlements.ts  copy.ts
   └─ types/database.ts     # generated from the database, never hand-edited
```

Conventions: TypeScript strict, no `any`; Server Components by default, Client Components only for interactivity; one Zod schema per form shared by client and server; mutations return `{ ok, error }` and never throw raw database errors to the user; regenerate `types/database.ts` after every migration; `lib/supabase/admin.ts` begins with `import 'server-only'`.

---

## 14. Development roadmap

Each phase ends with: lint + typecheck + tests green, `PROGRESS.md` updated, a "try it yourself" checklist for the owner, a commit, and a stop for approval.

**Phase 0 — Foundations**
Guide the owner through creating GitHub, Supabase (dev) and Vercel accounts and installing Node. Scaffold the project, Tailwind, shadcn/ui, fonts, design tokens, Supabase clients, environment files, CLAUDE.md, lint, test runner, first deploy of an empty shell.
_Done when:_ the app runs locally and on a Vercel preview URL.

**Phase 1 — Accounts and tenancy**
Auth pages, email verification, password reset. Migrations for `profiles`, `businesses`, `business_members`, `business_counters`, `plans`, `subscriptions`, `platform_admins`, `audit_logs`, the `private` helper functions and all RLS policies. `create_business` function. Onboarding wizard with logo upload. Route protection.
_Done when:_ two test accounts each create a business, and the automated isolation tests prove neither can read or write the other's rows.

**Phase 2 — App shell and people**
Sidebar, mobile bottom bar, "+ New" sheet, page header, data table and form components, empty states. Customers, suppliers, expense categories (with defaults), business settings.
_Done when:_ the shell works at 360 px and 1440 px, and customers, suppliers and categories can be added, edited and archived.

**Phase 3 — Sales and collecting**
`sales`, `sale_items`, `customer_payments`, triggers, `sales_overview`, the sale functions. Quick and multi-item sale form, sale detail with payment history, record payment, To Collect page, edit and void.
_Done when:_ the money-rule tests for totals, status, overpayment, edit limits and void pass, and a sale can be saved from a phone in three taps plus the amount.

**Phase 4 — Purchases, expenses and other money**
Purchases, items, supplier payments and To Pay (mirroring Phase 3). Expenses. Other Money In / Out.
_Done when:_ every money rule in Section 3 has a passing test.

**Phase 5 — Dashboard and transaction history**
`get_dashboard`, series functions, cards, charts, period filter. `transactions_feed` page with search, filters, sorting and row actions. Customer and supplier profile totals.
_Done when:_ dashboard figures match a hand-calculated seed dataset exactly, including across a month boundary and on "today" in Manila time.

**Phase 6 — Reports**
All ten reports with date filter, totals, CSV export and print layout.
_Done when:_ every report total agrees with the dashboard for the same period.

**Phase 7 — Hardening and launch**
Audit log viewer for owners, error and not-found pages, loading states, accessibility pass, mobile QA on every page, security headers, privacy and terms pages, production Supabase project, custom SMTP, backups, production deploy, smoke test.
_Done when:_ the MVP checklist below is fully ticked.

**Phase 8 — Admin and subscriptions (after MVP)**
`/admin`: list businesses and owners, plan and status, signup date, last activity, record counts; activate, suspend, change plan, extend trial; admin action log. Trial banner and expired state in the app. Entitlement checks wired to `plans.limits`. Payment gateway comes after this.

**MVP definition of done**

- [ ] A new user can sign up, verify, set up a business and record a sale in under two minutes
- [ ] All tenant-isolation tests pass against the production schema
- [ ] All money-rule tests pass; dashboard, reports and history agree to the centavo
- [ ] Every page is usable at 360 px wide
- [ ] No money record can be permanently deleted from the interface; every change is in the audit log
- [ ] No secret key is present in any client bundle
- [ ] Backups and custom email sender are on in production

---

## 15. Testing requirements

**Tenant isolation (required).** Create Business A and Business B with different users. For every business-owned table and view, assert that user A: cannot select B's rows; cannot insert a row with B's `business_id`; cannot update or void B's rows; cannot attach an A document to a B customer or supplier; cannot read B's logo from storage. Also assert that an unauthenticated client can read nothing. Add a test that fails if any `public` table has RLS disabled, so new tables cannot be forgotten.

**Money rules (required).** One test per rule in Section 3, including: line rounding with fractional quantities (for example 1.333 × 49.99); discount limits; derived status transitions; overpayment rejected; total cannot drop below amount paid; void cascades to payments; voided records excluded from every figure; profit versus cash for an unpaid sale; cash balance with starting balance and other money in/out; one sale paid with two different methods is split correctly; per-method totals add up exactly to total Money In and Money Out; period boundaries at month end and at midnight Manila time.

**Unit tests.** Money formatting and parsing, date-range helpers, Zod schemas.

**Smoke test.** One Playwright run: sign up → onboarding → record sale → see it on the dashboard.

---

## 16. Designing for the future

Keep these doors open without building them:

- **Inventory, POS, barcode:** items already live in their own tables; a `products` table and nullable `product_id` slot in later.
- **Multiple money accounts:** payments already carry a `method`; a later `accounts` table can be referenced by a nullable `account_id`, with existing rows mapped by method.
- **Staff and roles:** membership table and role-aware policies exist from Phase 1.
- **Multiple businesses or branches per user:** access is by membership, and the current business is resolved in one helper, so a business switcher is a small addition. Branches can be a nullable `branch_id` on money tables.
- **Invoices, receipts, reminders:** sales have reference numbers, due dates and customers.
- **Receipt photos and AI scanning:** storage is already partitioned by `business_id`.
- **VAT and BIR reports:** add tax columns to items and documents; reports are SQL functions and can be extended.
- **Recurring transactions and notifications:** scheduled functions that call the same create functions.
- **Mobile app:** all business logic is in Postgres functions and views, reusable by any client.
- **Billing:** `plans.limits` and a single `entitlements.ts` helper are the only places limits are decided.

---

## 17. Assumed defaults (owner may change before Phase 1)

| #   | Assumption                                                                                                                                                                                    | Alternative                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **Confirmed by owner:** payment methods include Cash, GCash, Online Bank and Credit Card. Maya, Cheque and Other are kept as extra options; pay-later (utang) is "Not yet paid", not a method | Remove Maya, Cheque or Other; let each business add its own methods |
| 2   | One business per account in the MVP                                                                                                                                                           | Business switcher at launch                                         |
| 3   | Owner login only in the MVP                                                                                                                                                                   | Staff logins at launch                                              |
| 4   | English interface with simple wording                                                                                                                                                         | English and Filipino at launch                                      |
| 5   | No VAT or tax fields in the MVP                                                                                                                                                               | Add VAT-inclusive pricing now                                       |
| 6   | 14-day free trial; plans activated manually by the admin after payment by GCash or bank transfer                                                                                              | Online gateway (PayMongo, Xendit, Maya) at launch                   |
| 7   | Admin dashboard built in Phase 8, right after the MVP                                                                                                                                         | Build before the first client                                       |
| 8   | Expenses are always paid when recorded                                                                                                                                                        | Support unpaid bills                                                |
| 9   | Weeks start on Monday                                                                                                                                                                         | Sunday                                                              |
| 10  | A single combined cash balance, plus Money In and Money Out totals per payment method                                                                                                         | A separate running balance for cash, GCash and each bank account    |
