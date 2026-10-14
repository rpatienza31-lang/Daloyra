import { describe, expect, it } from "vitest";
import { buildReportView, reportCsv, reportPeriodLabel } from "./model";
import type { ReportPeriod } from "./schema";

const october: ReportPeriod = {
  period: "this_month",
  from: "2026-10-01",
  to: "2026-10-31",
  invalid: false,
};

describe("buildReportView", () => {
  it("lays out Profit and Loss with expenses by category and the profit as the total", () => {
    const view = buildReportView(
      {
        type: "profit-and-loss",
        data: {
          from: "2026-10-01",
          to: "2026-10-31",
          rows: [
            {
              id: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a11",
              category: "Rent",
              count: 1,
              amount: "100.00",
            },
          ],
          totals: {
            sales: "50.00",
            cost_of_sales: "0.00",
            purchases: "0.00",
            stock_losses: "0.00",
            expenses: "100.00",
            profit: "-50.00",
          },
        },
      },
      october,
    );
    expect(view.rows.map((r) => r.cells.line)).toEqual([
      "Sales",
      "Less: Purchases",
      "Less: Expenses",
      "Rent",
      "Expenses",
    ]);
    expect(view.totals).toEqual({ line: "Loss", amount: "-50.00" });
    expect(view.summary.at(-1)).toMatchObject({ amount: "-50.00", signed: true });
  });

  it("shows the cost of products sold once products are used (Phase 9)", () => {
    const view = buildReportView(
      {
        type: "profit-and-loss",
        data: {
          from: "2025-10-01",
          to: "2025-10-31",
          rows: [],
          totals: {
            sales: "490.00",
            cost_of_sales: "306.00",
            purchases: "10.00",
            stock_losses: "35.00",
            expenses: "50.00",
            profit: "89.00",
          },
        },
      },
      october,
    );
    expect(view.rows.map((r) => [r.cells.line, r.cells.amount])).toEqual([
      ["Sales", "490.00"],
      ["Less: Cost of products sold", "306.00"],
      ["Less: Other purchases (not for stock)", "10.00"],
      ["Less: Stock lost or damaged", "35.00"],
      ["Less: Expenses", null],
      ["Expenses", "50.00"],
    ]);
    expect(view.summary[1]).toMatchObject({ label: "Cost of products sold", amount: "306.00" });
    expect(view.totals).toEqual({ line: "Profit", amount: "89.00" });
  });

  it("lists profit per product with links and explains what is not split", () => {
    const view = buildReportView(
      {
        type: "profit-by-product",
        data: {
          from: "2025-10-01",
          to: "2025-10-31",
          rows: [
            {
              product_id: "a0a0a0a0-0000-4000-8000-00000000a1ce",
              product: "Rice",
              unit: "kg",
              quantity: "7",
              sales: "370.00",
              cost: "236.00",
              profit: "134.00",
            },
          ],
          totals: {
            sales: "370.00",
            cost: "236.00",
            profit: "134.00",
            other_items: "20.00",
            discounts: "0.00",
          },
        },
      },
      october,
    );
    expect(view.rows[0]?.href).toBe("/products/a0a0a0a0-0000-4000-8000-00000000a1ce");
    expect(view.rows[0]?.cells.quantity).toBe("7 kg");
    expect(view.totals?.profit).toBe("134.00");
    expect(view.note).toContain("20.00");
  });

  it("links each payment method to its transactions for the same dates", () => {
    const view = buildReportView(
      {
        type: "payment-methods",
        data: {
          from: "2026-10-01",
          to: "2026-10-31",
          rows: [{ method: "gcash", money_in: "400.00", money_out: "50.00", net: "350.00" }],
          totals: { money_in: "400.00", money_out: "50.00", net: "350.00" },
        },
      },
      october,
    );
    expect(view.rows[0]?.href).toBe("/transactions?method=gcash&from=2026-10-01&to=2026-10-31");
    expect(view.rows[0]?.cells.method).toBe("GCash");
  });

  it("names walk-in sales in Sales by Customer", () => {
    const view = buildReportView(
      {
        type: "sales-by-customer",
        data: {
          from: null,
          to: null,
          rows: [
            {
              party_id: null,
              party: null,
              count: 2,
              total: "10.00",
              paid: "10.00",
              balance: "0.00",
            },
          ],
          totals: { count: 2, total: "10.00", paid: "10.00", balance: "0.00" },
        },
      },
      { period: "all_time", from: null, to: null, invalid: false },
    );
    expect(view.rows[0]?.cells.party).toBe("Walk-in");
    expect(view.rows[0]?.href).toBeUndefined();
  });
});

describe("reportCsv", () => {
  const view = buildReportView(
    {
      type: "expenses",
      data: {
        from: "2026-10-01",
        to: "2026-10-31",
        rows: [
          {
            id: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a11",
            category: 'Rent, "main"',
            count: 1,
            amount: "1234.50",
          },
          {
            id: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a12",
            category: "=HYPERLINK(1)",
            count: 2,
            amount: "0.05",
          },
        ],
        totals: { count: 3, amount: "1234.55" },
      },
    },
    october,
  );
  const csv = reportCsv(view, { business: "Niño Store", title: "Expenses", period: "October" });
  const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");

  it("writes exact amounts, quoted text and a totals row", () => {
    expect(lines[0]).toBe("Niño Store,Expenses,October");
    expect(lines[2]).toBe("Category,Records,Amount");
    expect(lines[3]).toBe('"Rent, ""main""",1,1234.50');
    expect(lines.at(-1)).toBe("Total,3,1234.55");
  });

  it("defuses text a spreadsheet would run as a formula", () => {
    expect(lines[4]).toBe("'=HYPERLINK(1),2,0.05");
  });

  it("starts with a byte order mark for Excel", () => {
    expect(csv.startsWith("﻿")).toBe(true);
  });
});

describe("reportPeriodLabel", () => {
  it("names the period and its dates", () => {
    expect(reportPeriodLabel(october)).toBe("This month · Oct 1, 2026 – Oct 31, 2026");
    expect(reportPeriodLabel({ period: "all_time", from: null, to: null, invalid: false })).toBe(
      "All dates",
    );
  });
});
