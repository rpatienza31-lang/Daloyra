import { z } from "zod";
import { periodRange, type PeriodKey } from "@/lib/dates";
import { PAYMENT_METHOD_VALUES } from "@/lib/payment-methods";

/**
 * The ten reports of SPEC Section 10, plus Profit by Product (Phase 9), by URL slug, with the
 * Postgres function behind each.
 */
export const REPORTS = {
  sales: { fn: "report_sales", group: "moneyIn", defaultPeriod: "this_month" },
  "sales-by-customer": {
    fn: "report_sales_by_customer",
    group: "moneyIn",
    defaultPeriod: "this_month",
  },
  "to-collect": { fn: "report_to_collect", group: "moneyIn", defaultPeriod: "all_time" },
  purchases: { fn: "report_purchases", group: "moneyOut", defaultPeriod: "this_month" },
  "purchases-by-supplier": {
    fn: "report_purchases_by_supplier",
    group: "moneyOut",
    defaultPeriod: "this_month",
  },
  expenses: { fn: "report_expenses", group: "moneyOut", defaultPeriod: "this_month" },
  "to-pay": { fn: "report_to_pay", group: "moneyOut", defaultPeriod: "all_time" },
  "profit-and-loss": { fn: "report_profit_loss", group: "summaries", defaultPeriod: "this_month" },
  "profit-by-product": {
    fn: "report_profit_by_product",
    group: "summaries",
    defaultPeriod: "this_month",
  },
  "cash-flow": { fn: "report_cash_flow", group: "summaries", defaultPeriod: "this_month" },
  "payment-methods": {
    fn: "report_payment_methods",
    group: "summaries",
    defaultPeriod: "this_month",
  },
} as const;

export type ReportType = keyof typeof REPORTS;
export const REPORT_TYPES = Object.keys(REPORTS) as ReportType[];

export function isReportType(value: string): value is ReportType {
  return Object.hasOwn(REPORTS, value);
}

// ---------------------------------------------------------------------------
// Period: like the dashboard, plus "All dates" (from and to are null).
// ---------------------------------------------------------------------------

export const REPORT_PERIODS = [
  "today",
  "this_week",
  "this_month",
  "this_year",
  "all_time",
  "custom",
] as const;
export type ReportPeriodKey = (typeof REPORT_PERIODS)[number];

export interface ReportPeriod {
  period: ReportPeriodKey;
  from: string | null;
  to: string | null;
  /** A custom range was asked for but was not valid; the default is used instead. */
  invalid: boolean;
}

const customRange = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((r) => r.from <= r.to);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function rangeFor(period: Exclude<ReportPeriodKey, "custom">, timezone: string, now: Date) {
  if (period === "all_time") return { from: null, to: null };
  return periodRange(period satisfies PeriodKey, timezone, now);
}

export function selectReportPeriod(
  params: Record<string, string | string[] | undefined>,
  defaultPeriod: Exclude<ReportPeriodKey, "custom">,
  timezone: string,
  now: Date = new Date(),
): ReportPeriod {
  const period = REPORT_PERIODS.find((p) => p === first(params.period)) ?? defaultPeriod;
  if (period === "custom") {
    const parsed = customRange.safeParse({ from: first(params.from), to: first(params.to) });
    if (parsed.success) return { period, ...parsed.data, invalid: false };
    return { period: defaultPeriod, ...rangeFor(defaultPeriod, timezone, now), invalid: true };
  }
  return { period, ...rangeFor(period, timezone, now), invalid: false };
}

/** The query string that reproduces a period, for links such as the CSV download. */
export function periodQuery(p: ReportPeriod): string {
  const q = new URLSearchParams({ period: p.period });
  if (p.period === "custom" && p.from && p.to) {
    q.set("from", p.from);
    q.set("to", p.to);
  }
  return q.toString();
}

// ---------------------------------------------------------------------------
// What each Postgres function returns. Amounts are decimal strings, checked here.
// ---------------------------------------------------------------------------

const amount = z.string().regex(/^-?\d+\.\d{2}$/);
const isoDate = z.iso.date();
const docStatus = z.enum(["paid", "partial", "unpaid", "voided"]);
const dueStatus = z.enum(["overdue", "due_soon", "not_due", "no_due_date"]).nullable();

const documentRow = z.object({
  id: z.uuid(),
  date: isoDate,
  reference: z.string(),
  party: z.string().nullable(),
  total: amount,
  paid: amount,
  balance: amount,
  status: docStatus,
  due_status: dueStatus,
});
const documentTotals = z.object({
  count: z.number(),
  total: amount,
  paid: amount,
  balance: amount,
});

const openRow = documentRow.omit({ status: true }).extend({
  due_date: isoDate.nullable(),
  days_overdue: z.number().nullable(),
});
const openTotals = documentTotals.extend({ overdue: amount });

const partyRow = z.object({
  party_id: z.uuid().nullable(),
  party: z.string().nullable(),
  count: z.number(),
  total: amount,
  paid: amount,
  balance: amount,
});

const categoryRow = z.object({
  id: z.uuid(),
  category: z.string(),
  count: z.number(),
  amount,
});

const envelope = <R extends z.ZodType, T extends z.ZodType>(row: R, totals: T) =>
  z.object({ from: isoDate.nullable(), to: isoDate.nullable(), rows: z.array(row), totals });

export const reportDataSchemas = {
  sales: envelope(documentRow, documentTotals),
  purchases: envelope(documentRow, documentTotals),
  "to-collect": envelope(openRow, openTotals),
  "to-pay": envelope(openRow, openTotals),
  "sales-by-customer": envelope(partyRow, documentTotals),
  "purchases-by-supplier": envelope(partyRow, documentTotals),
  expenses: envelope(categoryRow, z.object({ count: z.number(), amount })),
  "profit-and-loss": envelope(
    categoryRow,
    z.object({
      sales: amount,
      cost_of_sales: amount,
      purchases: amount,
      stock_losses: amount,
      expenses: amount,
      profit: amount,
    }),
  ),
  "profit-by-product": envelope(
    z.object({
      product_id: z.uuid(),
      product: z.string(),
      unit: z.string(),
      quantity: z.string(),
      sales: amount,
      cost: amount,
      profit: amount,
    }),
    z.object({
      sales: amount,
      cost: amount,
      profit: amount,
      other_items: amount,
      discounts: amount,
    }),
  ),
  "cash-flow": envelope(
    z.object({ direction: z.enum(["in", "out"]), line: z.string(), amount }),
    z.object({
      money_in: amount,
      money_out: amount,
      net: amount,
      opening_date: isoDate,
      opening: amount,
      closing_date: isoDate,
      closing: amount,
    }),
  ),
  "payment-methods": envelope(
    z.object({
      method: z.enum(PAYMENT_METHOD_VALUES),
      money_in: amount,
      money_out: amount,
      net: amount,
    }),
    z.object({ money_in: amount, money_out: amount, net: amount }),
  ),
} satisfies Record<ReportType, z.ZodType>;

export type ReportData = {
  [K in ReportType]: { type: K; data: z.output<(typeof reportDataSchemas)[K]> };
}[ReportType];
