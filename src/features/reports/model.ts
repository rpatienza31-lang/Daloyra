import { copy } from "@/lib/copy";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { ReportData, ReportPeriod } from "./schema";

/*
 * Turns what a report function returned into rows and columns for the screen, the print
 * layout and the CSV file alike. Pure re-arranging and labelling: every amount here was
 * computed by Postgres, and nothing is added up.
 */

export type ColumnKind = "text" | "date" | "money" | "number";

export interface ReportColumn {
  key: string;
  label: string;
  kind: ColumnKind;
}

export interface ReportRow {
  key: string;
  cells: Record<string, string | null>;
  href?: string;
  /** "heading" rows label a group; "subtotal" rows close one. */
  style?: "heading" | "subtotal";
  /** Shown indented under a heading row. */
  indent?: boolean;
}

export interface ReportSummaryItem {
  label: string;
  amount: string;
  /** Show the sign in color and words (profit / loss, net). */
  signed?: boolean;
}

export interface ReportView {
  summary: ReportSummaryItem[];
  columns: ReportColumn[];
  rows: ReportRow[];
  /** The totals row, keyed like the cells; null when the summary says it all. */
  totals: Record<string, string | null> | null;
  note?: string;
}

const r = copy.reports;
const c = r.columns;
const s = r.summary;

function transactionsLink(query: Record<string, string | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) q.set(k, v);
  return `/transactions?${q.toString()}`;
}

function otherMoneyLabel(line: string): string {
  const kinds: Record<string, string> = copy.otherMoney.types;
  return kinds[line.replace(/^other_/, "")] ?? line;
}

export function buildReportView(report: ReportData, period: ReportPeriod): ReportView {
  switch (report.type) {
    case "sales":
    case "purchases": {
      const { rows, totals } = report.data;
      const sales = report.type === "sales";
      return {
        summary: [
          { label: s.total, amount: totals.total },
          { label: s.paid, amount: totals.paid },
          { label: s.balance, amount: totals.balance },
        ],
        columns: [
          { key: "date", label: c.date, kind: "date" },
          { key: "reference", label: c.reference, kind: "text" },
          { key: "party", label: sales ? c.customer : c.supplier, kind: "text" },
          { key: "status", label: c.status, kind: "text" },
          { key: "total", label: c.total, kind: "money" },
          { key: "paid", label: c.paid, kind: "money" },
          { key: "balance", label: c.balance, kind: "money" },
        ],
        rows: rows.map((x) => ({
          key: x.id,
          href: `/${sales ? "sales" : "purchases"}/${x.id}`,
          cells: {
            date: x.date,
            reference: x.reference,
            party: x.party ?? (sales ? r.walkIn : null),
            status:
              x.due_status === "overdue" ? copy.sales.status.overdue : copy.sales.status[x.status],
            total: x.total,
            paid: x.paid,
            balance: x.balance,
          },
        })),
        totals: { date: r.total, total: totals.total, paid: totals.paid, balance: totals.balance },
      };
    }

    case "to-collect":
    case "to-pay": {
      const { rows, totals } = report.data;
      const collect = report.type === "to-collect";
      return {
        summary: [
          { label: s.balance, amount: totals.balance },
          { label: s.overdue, amount: totals.overdue },
        ],
        columns: [
          { key: "date", label: c.date, kind: "date" },
          { key: "reference", label: c.reference, kind: "text" },
          { key: "party", label: collect ? c.customer : c.supplier, kind: "text" },
          { key: "dueDate", label: c.dueDate, kind: "date" },
          { key: "daysOverdue", label: c.daysOverdue, kind: "number" },
          { key: "total", label: c.total, kind: "money" },
          { key: "paid", label: c.paid, kind: "money" },
          { key: "balance", label: c.balance, kind: "money" },
        ],
        rows: rows.map((x) => ({
          key: x.id,
          href: `/${collect ? "sales" : "purchases"}/${x.id}`,
          cells: {
            date: x.date,
            reference: x.reference,
            party: x.party ?? (collect ? r.walkIn : null),
            dueDate: x.due_date,
            daysOverdue: x.days_overdue === null ? null : String(x.days_overdue),
            total: x.total,
            paid: x.paid,
            balance: x.balance,
          },
        })),
        totals: { date: r.total, total: totals.total, paid: totals.paid, balance: totals.balance },
      };
    }

    case "sales-by-customer":
    case "purchases-by-supplier": {
      const { rows, totals } = report.data;
      const sales = report.type === "sales-by-customer";
      return {
        summary: [
          { label: sales ? s.sales : s.purchases, amount: totals.total },
          { label: s.paid, amount: totals.paid },
          { label: s.balance, amount: totals.balance },
        ],
        columns: [
          { key: "party", label: sales ? c.customer : c.supplier, kind: "text" },
          { key: "count", label: c.count, kind: "number" },
          { key: "total", label: sales ? c.sales : c.purchases, kind: "money" },
          { key: "paid", label: c.paid, kind: "money" },
          { key: "balance", label: c.balance, kind: "money" },
        ],
        rows: rows.map((x) => ({
          key: x.party_id ?? "walk-in",
          href: x.party_id ? `/${sales ? "customers" : "suppliers"}/${x.party_id}` : undefined,
          cells: {
            party: x.party ?? r.walkIn,
            count: String(x.count),
            total: x.total,
            paid: x.paid,
            balance: x.balance,
          },
        })),
        totals: {
          party: r.total,
          count: String(totals.count),
          total: totals.total,
          paid: totals.paid,
          balance: totals.balance,
        },
      };
    }

    case "expenses": {
      const { rows, totals } = report.data;
      return {
        summary: [{ label: s.expenses, amount: totals.amount }],
        columns: [
          { key: "category", label: c.category, kind: "text" },
          { key: "count", label: c.count, kind: "number" },
          { key: "amount", label: c.amount, kind: "money" },
        ],
        rows: rows.map((x) => ({
          key: x.id,
          href: `/expenses?category=${x.id}`,
          cells: { category: x.category, count: String(x.count), amount: x.amount },
        })),
        totals: { category: r.total, count: String(totals.count), amount: totals.amount },
      };
    }

    case "profit-and-loss": {
      const { rows, totals } = report.data;
      const l = r.lines;
      return {
        summary: [
          { label: s.sales, amount: totals.sales },
          { label: s.purchases, amount: totals.purchases },
          { label: s.expenses, amount: totals.expenses },
          { label: s.profit, amount: totals.profit, signed: true },
        ],
        columns: [
          { key: "line", label: c.line, kind: "text" },
          { key: "amount", label: c.amount, kind: "money" },
        ],
        rows: [
          { key: "sales", cells: { line: l.sales, amount: totals.sales } },
          { key: "purchases", cells: { line: l.purchases, amount: totals.purchases } },
          { key: "expenses", style: "heading", cells: { line: l.expensesHeading, amount: null } },
          ...rows.map((x) => ({
            key: `expense-${x.id}`,
            indent: true,
            cells: { line: x.category, amount: x.amount },
          })),
          {
            key: "expenses-total",
            style: "subtotal",
            cells: { line: s.expenses, amount: totals.expenses },
          },
        ],
        totals: {
          line: totals.profit.startsWith("-") ? l.loss : l.profit,
          amount: totals.profit,
        },
      };
    }

    case "cash-flow": {
      const { rows, totals } = report.data;
      const l = r.lines;
      const label = (line: string) =>
        line === "customer_payment" || line === "supplier_payment" || line === "expense"
          ? l[line]
          : otherMoneyLabel(line);
      const lineRows = (direction: "in" | "out"): ReportRow[] =>
        rows
          .filter((x) => x.direction === direction)
          .map((x) => ({
            key: `${direction}-${x.line}`,
            indent: true,
            cells: {
              line: label(x.line),
              moneyIn: direction === "in" ? x.amount : null,
              moneyOut: direction === "out" ? x.amount : null,
            },
          }));
      return {
        summary: [
          { label: s.opening(formatIso(totals.opening_date)), amount: totals.opening },
          { label: s.moneyIn, amount: totals.money_in },
          { label: s.moneyOut, amount: totals.money_out },
          { label: s.closing(formatIso(totals.closing_date)), amount: totals.closing },
        ],
        columns: [
          { key: "line", label: c.line, kind: "text" },
          { key: "moneyIn", label: c.moneyIn, kind: "money" },
          { key: "moneyOut", label: c.moneyOut, kind: "money" },
        ],
        rows: [
          { key: "in", style: "heading", cells: { line: s.moneyIn } },
          ...lineRows("in"),
          { key: "out", style: "heading", cells: { line: s.moneyOut } },
          ...lineRows("out"),
        ],
        totals: { line: r.total, moneyIn: totals.money_in, moneyOut: totals.money_out },
        note: r.cashFlowNote,
      };
    }

    case "payment-methods": {
      const { rows, totals } = report.data;
      return {
        summary: [
          { label: s.moneyIn, amount: totals.money_in },
          { label: s.moneyOut, amount: totals.money_out },
          { label: s.net, amount: totals.net, signed: true },
        ],
        columns: [
          { key: "method", label: c.method, kind: "text" },
          { key: "moneyIn", label: c.moneyIn, kind: "money" },
          { key: "moneyOut", label: c.moneyOut, kind: "money" },
          { key: "net", label: c.net, kind: "money" },
        ],
        rows: rows.map((x) => ({
          key: x.method,
          href: transactionsLink({ method: x.method, from: period.from, to: period.to }),
          cells: {
            method: paymentMethodLabel(x.method),
            moneyIn: x.money_in,
            moneyOut: x.money_out,
            net: x.net,
          },
        })),
        totals: {
          method: r.total,
          moneyIn: totals.money_in,
          moneyOut: totals.money_out,
          net: totals.net,
        },
      };
    }
  }
}

/** "2026-10-31" → "Oct 31, 2026", without timezone shifts. */
function formatIso(date: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

// ---------------------------------------------------------------------------
// CSV (SPEC 2.1 #9): plain values a spreadsheet can add up. Amounts stay exact decimal
// strings, dates stay ISO. Text that a spreadsheet could run as a formula is defused.
// ---------------------------------------------------------------------------

function csvCell(value: string | null, kind: ColumnKind | "label"): string {
  if (value === null) return "";
  let v = value;
  if ((kind === "text" || kind === "label") && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

export function reportCsv(
  view: ReportView,
  heading: { business: string; title: string; period: string },
): string {
  const lines: string[] = [
    [heading.business, heading.title, heading.period].map((v) => csvCell(v, "label")).join(","),
    "",
    view.columns.map((col) => csvCell(col.label, "label")).join(","),
    ...view.rows.map((row) =>
      view.columns.map((col) => csvCell(row.cells[col.key] ?? null, col.kind)).join(","),
    ),
  ];
  if (view.totals) {
    const totals = view.totals;
    lines.push(view.columns.map((col) => csvCell(totals[col.key] ?? null, col.kind)).join(","));
  }
  // Byte order mark so Excel opens names like "Niño" correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** "This month · Oct 1, 2026 – Oct 31, 2026", or "All dates". */
export function reportPeriodLabel(period: ReportPeriod): string {
  if (!period.from || !period.to) return r.allDates;
  const range =
    period.from === period.to
      ? formatIso(period.from)
      : `${formatIso(period.from)} – ${formatIso(period.to)}`;
  return period.period === "custom"
    ? range
    : `${copy.app.dashboard.periods[period.period]} · ${range}`;
}
