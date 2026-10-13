# Daloyra — Progress

## Status

| Phase                                | State                                     |
| ------------------------------------ | ----------------------------------------- |
| 0 — Foundations                      | Done — live at https://daloyra.vercel.app |
| 1 — Accounts and tenancy             | Done — approved 12 Oct 2026               |
| 2 — App shell and people             | Done — approved 12 Oct 2026               |
| 3 — Sales and collecting             | Done — approved 13 Oct 2026               |
| 4 — Purchases, expenses, other money | Done — approved 13 Oct 2026               |
| 5 — Dashboard and history            | Done — approved 13 Oct 2026               |
| 6 — Reports                          | Built — waiting for owner check           |
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

## Phase 2 — what exists

- **Database**: `customers`, `suppliers` (same shape) and `expense_categories` (names unique per
  business ignoring capitals; 9 defaults added by a trigger on new businesses and backfilled).
  Everyone in a business can view and add customers/suppliers; owner and manager edit and archive;
  categories are managed by owner and manager. No deletes. `created_by`/`updated_by` are stamped
  by a trigger. `update_business_settings(...)` saves the profile with the starting cash as a
  decimal string and refuses a starting date after today in the business timezone.
- **Database tests**: 110 checks (Phase 1 suites, now also covering the new tables
  automatically, plus `03_people_and_categories` and `04_business_settings`).
- **App shell**: desktop sidebar (Overview · Money In · Money Out · People · Insights ·
  Settings; pages from later phases show "Soon"), top bar with business name, logo and "+ New";
  phone bottom bar Home · Sales · **+** · Expenses · More. The "+ New" sheet lists the six money
  forms (coming in Phases 3–4) plus Customer and Supplier.
- **Shared components**: page header, empty state, searchable/sortable data table that turns into
  stacked cards under 768 px (TanStack Table v9), side sheet, confirmation dialog, toasts, badge.
- **Pages**: `/customers`, `/customers/[id]`, `/suppliers`, `/suppliers/[id]` (add, edit,
  archive, restore, search, active/archived), `/settings/business` (profile, logo change/remove,
  currency, starting cash and date), `/settings/categories`, `/settings/account` (name, change
  password). The dashboard shows the first-time empty state with its three buttons.

## Phase 3 — what exists

- **Database** (`20261013000100_sales.sql`): `sales`, `sale_items`, `customer_payments`.
  - `line_total = round(quantity × unit_price, 2)` and `total = subtotal − discount` are
    generated columns; `subtotal` is kept equal to the sum of the lines by a trigger.
  - `private.validate_sale` checks every document rule (at least one item, discount ≤ subtotal,
    total ≥ paid, a balance needs a customer, no payment before the sale date) at the end of every
    write function, and again in deferred constraint triggers at commit.
  - Payments: a trigger locks the sale row and refuses overpayment; payments cannot be edited
    (void and re-record); voiding a sale voids its payments in the same transaction; the
    payment's customer always follows the sale.
  - Write functions (SECURITY DEFINER, role and suspension checked inside): `create_sale`,
    `update_sale`, `void_sale`, `record_customer_payment`, `void_customer_payment`. The app has
    SELECT only on the tables. Client-generated ids make retries safe.
  - `sales_overview` (security invoker): amount paid, balance, payment status and due status,
    derived from non-voided payments and "today" in the business timezone.
    `get_amount_to_collect(business, customer?)` sums balances in SQL.
  - Reference numbers S-0001… skip numbers typed in by hand; currency locks once a sale exists;
    one audit entry per sale change with an item snapshot, plus payment audit rows.
- **Database tests**: 181 checks, including `05_sales_money_rules` (71): rounding with fractional
  quantities, discount limits, status transitions, overpayment, edit limits, void cascade,
  voided records excluded, split methods, reference numbers, roles, cross-tenant writes and the
  commit-time check.
- **App**: `/sales` (filters: all, to collect, paid, voided; payment method), `/sales/new` (quick
  sale: amount → Save; or several items, discount, customer with inline "new customer", date,
  reference, notes; Did they pay? with method chips), `/sales/[id]` (items, totals, balance,
  payments with method pills, Record payment, Edit, Cancel (Void) with the amounts stated,
  cancel a payment), `/sales/[id]/edit`, `/receivables` (To Collect with the total from SQL).
  Customer pages show what they owe and their sales. Navigation, "+ New" and the dashboard
  button now lead to these pages.
- Tested end to end against the dev database with a temporary account (deleted afterwards):
  sign in, setup, quick sale, multi-item unpaid sale, part payment, To Collect, refused edit,
  void.

## Phase 4 — what exists

- **Database**:
  - `20261014000100_purchases.sql`: `purchases`, `purchase_items`, `supplier_payments`,
    `purchases_overview`, `get_amount_to_pay`, and `create/update/void_purchase`,
    `record/void_supplier_payment`: the exact mirror of sales (generated from the sales migration
    and reviewed). Reference numbers P-0001… (separate series from sales).
  - `20261014000200_expenses_other_money.sql`: `expenses` (category from the business's own,
    active categories; paid when recorded) and `cash_adjustments` ("Other Money In / Out": owner
    in/out, loan in/out, other; the type must fit the direction). Create/edit/void functions,
    audit trigger, voided records stay voided. Currency lock now covers every money record;
    `has_money_records`.
  - `20261014000300_period_figures.sql`: `money_movements` view (every payment, expense and other
    money entry), `get_dashboard(business, from, to)` (Sales, Purchases, Expenses, Profit, Money
    In/Out, net cash flow, Sales Today, Cash Balance, Amount to Collect/Pay) and
    `get_money_by_method(business, from, to)`. Built now so every money rule in SPEC 3 is tested
    this phase; Phase 5 shows them on the dashboard.
- **Database tests**: 250 checks. New: `06_purchases_money_rules`, `07_expenses_other_money`,
  and `08_period_figures`, a hand-calculated dataset covering profit vs cash for an unpaid sale,
  cash balance with starting cash and other money (and D3), voided records excluded, both sides
  of a month boundary, per-method totals adding up exactly, "today" in Manila, and isolation.
- **App**: `/purchases` (+ new, detail, edit, pay supplier, cancel), `/payables` (To Pay),
  `/expenses` (list with category, method and voided filters; add, edit and cancel in a side
  sheet), `/money` (Other Money In / Out with the loan-interest hint, D7). Supplier pages show what
  you owe and the purchases. Navigation, bottom bar, "+ New" and the dashboard buttons all work.
- Tested end to end against the dev database with a temporary account (deleted afterwards).

## Phase 5 — what exists

- **Database** (`20261015000100_dashboard_series_feed.sql`, all security invoker):
  - `get_monthly_series(business, months, end)`: Sales, Purchases, Expenses and Profit per month
    for the 12 months ending with the period's last month, empty months as zero.
  - `get_daily_series(business, from, to)`: Sales per day, at most a year.
  - `transactions_feed` view: every sale, purchase, payment received/made, expense and other money
    in/out in one list, with party, reference, first item, amount, Money In/Out, method and status
    (voided records included and flagged).
  - `customer_summary` / `supplier_summary` views: lifetime totals, paid and balance per person.
- **Database tests**: 274 checks. New `09_series_and_feed`: every month in the series matches the
  dashboard for that month, daily sales add up exactly to period Sales, the history's Money In/Out
  match the dashboard to the centavo, people totals, invalid ranges, and isolation (another
  business and signed-out visitors see nothing).
- **App**:
  - `/dashboard`: "Right now" cards (Sales Today, Cash Balance, Amount to Collect, Amount to
    Pay), a period filter (Today, This week, This month (default), This year, Custom) with Sales,
    Purchases, Expenses and Profit, info icons, three charts (Sales vs Purchases vs Expenses by
    month, Profit by month in green/red, daily Sales trend) each with a "as a table" view,
    "How money came in" per payment method with a Money In / Money Out toggle, Recent transactions
    (last 8) and Overdue to collect (top 5). The first-time screen stays until something is
    recorded.
  - `/transactions`: the unified history with search, sorting and filters (type, method, status,
    customer or supplier, dates). Each row opens its sale, purchase, expense or entry.
  - Customer and supplier pages show total sales/purchases, paid so far and what is still owed.
- Tested end to end against the dev database with a temporary account and a hand-calculated
  dataset across the Sept/Oct boundary (deleted afterwards).

## Phase 6 — what exists

- **Database** (`20261016000100_reports.sql`, all security invoker): one function per report,
  each returning its rows and its totals row computed in Postgres: `report_sales`,
  `report_purchases`, `report_expenses` (by category), `report_profit_loss`, `report_cash_flow`
  (Money In/Out by kind, cash at start and end), `report_payment_methods`, `report_to_collect`,
  `report_to_pay`, `report_sales_by_customer`, `report_purchases_by_supplier`. Dates may be left
  empty for "All dates".
- **Database tests**: 306 checks. New `10_reports`: every report total equals the dashboard for
  the same period (Sales, Purchases, Expenses, Profit, Money In/Out, net, Cash Balance, Amount to
  Collect/Pay), across a month boundary, with voided records left out, plus isolation.
- **App**:
  - `/reports`: the ten reports grouped as Money In, Money Out and Summaries.
  - `/reports/[type]`: date filter (Today, This week, This month, This year, All dates, Custom),
    summary figures, the table with a totals row, links into each record (and, for payment
    methods, to the matching transactions). **Download CSV** and **Print**.
  - `/reports/[type]/export`: the CSV file, built from the same figures (exact amounts, ISO dates,
    formula-safe text, opens correctly in Excel).
  - Print layout: no menus or buttons; business name and logo, report title, period and the
    print date at the top.
- Tested end to end against the dev database with a temporary account (deleted afterwards).

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
| D26 | Customers, suppliers and categories are saved directly through the Data API (RLS and column grants decide access); money records will go through Postgres functions. | Simple records; the database still enforces every rule. |
| D27 | Pages from later phases appear in the navigation as "Soon" rather than being hidden. | The owner sees the whole shape of the app as it grows. |
| D28 | The "+ New" sheet also offers Customer and Supplier. | Spec lists only money items; adding people quickly is common. |
| D29 | Currency can still be changed in Settings; it locks once the first money record exists (D6), enforced when sales arrive in Phase 3. | There are no money records before Phase 3. |
| D30 | Money tables are read-only for the app; every write goes through a SECURITY DEFINER function that checks membership, role and suspension itself. | Rules that span rows (totals, payments) cannot be bypassed. |
| D31 | Whole-sale rules are checked at the end of each function and again by deferred triggers at commit; payment overpayment is checked immediately with a row lock. | Editing items passes through in-between states. |
| D32 | Sale audit entries are written by the sale functions (one per change, with an item snapshot); payments use the generic audit trigger. | One readable entry per document change (D12). |
| D33 | "Paid in full" sends the word `full`; the database pays exactly the total it computed. | The app never computes a saved amount. |
| D34 | Staff can record payments only on sales they recorded; manager and owner on any sale. | Matches D10 (staff see their own entries). |
| D35 | Future sale dates are allowed; a due date cannot be before the sale date. | Spec silent; pre-orders exist. |
| D36 | "Other Money" gets its own sidebar entry (under Money Out) as well as the "+ New" sheet. | Spec has a page (`/money`) but no menu place for it. |
| D37 | The dashboard and money-by-method figures were built (and tested) in Phase 4; Phase 5 adds the series, the screens and charts. | Phase 4 must prove every rule in SPEC 3. |
| D38 | Products, inventory and a POS-style layout come after launch (owner asked; recommended order kept). | Spec 2.3 "Later"; changes how profit is counted. |
| D39 | Team logins (manager and cashier invitations) come after launch; roles already exist in the database. | Owner decision, 13 Oct. |
| D40 | The 12-month charts end with the month the selected period ends in (This year shows Jan–Dec). The daily trend needs a period of one year or less. | Spec left the window for a custom period open. |
| D41 | Staff (later) see no totals on the dashboard and only their own entries in Transactions. | SPEC 8 "own entries only". |
| D42 | Chart colors: Sales teal, Purchases orange, Expenses violet, checked for color blindness; the brand teal is too muted to tell apart in charts. Profit uses green/red with a minus sign and the word "loss". | Accessibility (SPEC 12). |
| D43 | Payments in Transactions open their sale or purchase; expenses and other money open in their own list. | One place to edit or cancel each record. |
| D44 | Reports have an extra "All dates" period. To Collect and To Pay open on All dates (they filter by the sale/purchase date); the other reports open on This month. | What is owed matters regardless of when the sale was made. |
| D45 | Cash Flow shows cash at the start and end using the Cash Balance rule (D3). The end is the period's last day or today, whichever is earlier, so This month ends with today's Cash Balance. | Matches the dashboard; future-dated entries are not cash yet. |
| D46 | Sales and Purchases reports list records that are not voided; "Paid" is everything paid on them so far (any date). | Same as the To Collect / To Pay pages. |
| D47 | CSV files hold plain amounts (no ₱ sign, no thousands separator) so a spreadsheet can add them up; they start with the business name, report and period. | For the bookkeeper. |
| D48 | Design pass (owner request, 13 Oct): each figure has a fixed color and icon everywhere: Sales teal-blue, Purchases amber, Expenses red-orange, Profit green (red when a loss), Cash brand teal, To Collect blue. The chart colors were re-checked for color blindness. Profit is the highlighted card; Profit and Loss reads as a statement with a colored bottom line. Pill-style period and filter tabs, list cards with type icons, refreshed sidebar. No calculation or data change. | Glanceable at first sight. |

D1–D14 were proposed to the owner and applied by default; the owner may still change any of them.

## Environment notes

- Supabase dev project ref: `rthblabylzscojupghle` (`https://rthblabylzscojupghle.supabase.co`).
- Vercel project `daloyra`: https://daloyra.vercel.app (Production currently deploys from branch `claude/daloyra-build-spec-dyputg`). Both public Supabase variables are set for all environments.
- The cloud sandbox network blocks `api.supabase.com`, `*.supabase.co`, `api.vercel.com` and
  `ui.shadcn.com` until they are added to the environment's allowed domains.

## Phase 6 — try it yourself

Use the newest Vercel preview for branch `claude/vigilant-meitner-pidrdu`. Database changes are
already applied to the dev project.

1. Open **Reports** (on a phone: **More → Reports**). You see ten reports in three groups.
2. Open **Profit and Loss**. Compare Sales, Purchases, Expenses and Profit with the dashboard
   for **This month**: they must be the same.
3. Tap **This year**, then **All dates**, then **Custom** and choose two dates → **Show**.
4. Tap **Download CSV**. Open the file in Excel or Google Sheets: the last row is the total.
5. Tap **Print** (on a computer). The preview shows your business name and logo, the report and
   the dates, with no menus.
6. Open **Cash Flow**: "Cash at end" for This month equals the dashboard's Cash Balance.
7. Open **Payment Methods** and tap **GCash**: it opens Transactions with only GCash records for
   the same dates.
8. Open **To Collect**: it starts on All dates and shows what customers still owe, overdue first.
9. Open **Sales by Customer**: tap a customer's name to open their page.

## Phase 5 — try it yourself

Use the newest Vercel preview for branch `claude/vigilant-meitner-pidrdu`. Database changes are
already applied to the dev project. You need a few records first; the ones from Phase 3 and 4
are fine.

1. Open **Dashboard**. Under "Right now" you see Sales Today, Cash Balance, Amount to Collect and
   Amount to Pay. Tap the small **ⓘ** next to Cash Balance: one sentence explains it.
2. Under the period buttons (default **This month**) check Sales, Purchases, Expenses and Profit.
   Profit should equal Sales − Purchases − Expenses.
3. Tap **Today**, then **This week**, then **This year**: the four period cards change; the "Right
   now" cards do not.
4. Tap **Custom** (scroll the buttons sideways on a phone), choose a From and To date, tap
   **Show**.
5. Scroll to the charts. On a computer, hover the bars to see exact amounts; on a phone, tap them.
   Tap "… as a table" under a chart to see the same numbers as a list.
6. In **How money came in**, tap **Money Out**: amounts and percentages per payment method.
7. At the bottom: **Recent transactions** (tap one to open it) and **Overdue to collect**.
8. Open **Transactions** (on a phone: **More → Transactions**). Type a customer name in the search
   box. Then choose **Type: Expense** → **Apply**, and **Clear filters**.
9. Open **Customers** → a customer: you now see Total sales, Paid so far and Owes you.

## Phase 4 — try it yourself

Use the newest Vercel preview for branch `claude/vigilant-meitner-pidrdu`. Database changes are
already applied to the dev project.

1. **Purchase on credit:** **+** → **Purchase** → amount `2500` → **Not yet** → tap the person icon
   and add a supplier → **Save purchase**. It shows "Purchase P-0001", Unpaid.
2. **Pay the supplier:** **Record payment** → `1000` → **Online Bank** → save. Partially Paid,
   balance ₱1,500.00.
3. **More → To Pay:** the purchase, with Amount to Pay ₱1,500.00.
4. **Expense:** **+** → **Expense** → `3500` → **Save expense**: it asks for a category. Choose
   Rent, tap **GCash**, save. Tap the expense to edit it, then **Cancel this expense (Void)**.
5. **Other money:** **More → Other Money** → **New entry** → Money In, "Owner put money in",
   `5000` → save. Add a Money Out "Loan repayment": a tip reminds you to record interest as an
   expense.
6. **Suppliers → your supplier:** "You owe" and the purchase.
7. On a computer, the sidebar now has Purchases, Expenses, To Pay and Other Money; only
   Transactions and Reports say "Soon".

## Phase 3 — try it yourself

Use the newest Vercel preview for branch `claude/vigilant-meitner-pidrdu`. The database changes are
already applied to the dev project.

1. **Quick sale (phone):** tap **+** → **Sale** → type `150` → **Save sale**. That's 3 taps plus the
   amount. You see "Sale S-0001", Paid, ₱150.00.
2. **Sale on credit:** **+** → **Sale** → **List several items**. Add "Rice", qty `1.333`, price
   `49.99` (line shows ₱66.64) and "Eggs", qty `12`, price `8.25`. Tap **Not yet**, then
   **Save sale**: it asks for a customer. Tap the person icon next to Customer, add "Aling Nena",
   pick a due date, **Save sale**. It shows ₱165.64, Unpaid.
3. **Collect part of it:** **Record payment** (the amount is already the balance). Type `200`:
   it says that's more than the balance. Type `100`, choose **GCash**, save. It shows Partially
   Paid, balance ₱65.64, and the payment with a GCash pill.
4. **More → To Collect:** the sale is listed with ₱65.64 and the total at the top.
5. **Edit:** open the sale → **Edit**, change prices to `1` → **Save sale**: refused, because
   ₱100 is already paid. Go back.
6. **Cancel:** **Cancel this sale (Void)**. The box says it cancels ₱165.64 and 1 payment of
   ₱100.00. Without a reason it asks for one; write a reason and confirm. The sale shows
   Voided and disappears from To Collect.
7. **Sales list:** both sales are listed; try the filters (To collect, Paid, Voided) and the
   payment method filter. Open **Customers → Aling Nena**: what she owes and her sales.
8. **Settings → Business:** the currency is now locked.

## Phase 2 — try it yourself

Use the newest Vercel preview for branch `claude/vigilant-meitner-pidrdu` and log in. The
database changes for Phase 2 are already applied to the dev project.

1. **Phone (or a narrow browser window):** at the bottom you see Home · Sales · **+** · Expenses ·
   More. Sales and Expenses are greyed out (they arrive next).
2. Tap **+**: the sheet shows Sale, Expense, Purchase and the payments as "Coming in the next
   update", plus **Customer** and **Supplier**. Tap **Customer**.
3. Tap **Save** with the name empty: it says "Enter a name." Type a name and phone number, then
   **Save**. You land on that customer's page with a "Customer added." message.
4. Tap **Edit**, change the phone number, **Save**. Then **Archive** → confirm. Go to
   **More → Customers**: the customer is gone from **Active** and listed under **Archived**.
   Open it and tap **Restore**.
5. Add two or three more customers and one supplier; type part of a name in the search box.
6. **More → Settings → Categories**: you see the 9 default categories. Add "Packaging", rename it,
   archive it. Try adding "rent": it says you already have that category.
7. **Settings → Business**: change the starting cash to `2500.50` (it shows ₱2,500.50 below),
   change the logo, **Save**. The new logo appears at the top. Try a starting date in the future:
   it is refused.
8. **Settings → Account**: change your name; change your password, log out and log in with it.
9. **Computer (wide window):** the sidebar shows all sections, with "Soon" on pages still to come,
   and a **+ New** button at the top right. Customer lists show as a table you can sort by
   clicking a column title.
10. With your second test account (if you made one), check it cannot see the first account's
    customers or categories.

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
