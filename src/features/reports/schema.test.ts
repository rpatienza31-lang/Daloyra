import { describe, expect, it } from "vitest";
import { isReportType, periodQuery, reportDataSchemas, selectReportPeriod } from "./schema";

const now = new Date("2026-10-13T15:30:00Z");

describe("selectReportPeriod", () => {
  it("uses the report's default", () => {
    expect(selectReportPeriod({}, "this_month", "Asia/Manila", now)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(selectReportPeriod({}, "all_time", "Asia/Manila", now)).toMatchObject({
      period: "all_time",
      from: null,
      to: null,
    });
  });

  it("falls back to the default for a broken custom range", () => {
    expect(
      selectReportPeriod(
        { period: "custom", from: "2026-10-31", to: "2026-10-01" },
        "all_time",
        "Asia/Manila",
        now,
      ),
    ).toMatchObject({ period: "all_time", invalid: true });
  });

  it("round-trips through the query string", () => {
    const p = selectReportPeriod(
      { period: "custom", from: "2026-09-30", to: "2026-10-01" },
      "this_month",
      "Asia/Manila",
      now,
    );
    expect(periodQuery(p)).toBe("period=custom&from=2026-09-30&to=2026-10-01");
  });
});

describe("report types and data", () => {
  it("knows the reports", () => {
    expect(isReportType("profit-and-loss")).toBe(true);
    expect(isReportType("profit-by-product")).toBe(true);
    expect(isReportType("toString")).toBe(false);
  });

  it("rejects amounts that are not exact decimal strings", () => {
    const base = { from: null, to: null, rows: [], totals: { count: 0, amount: "0.00" } };
    expect(reportDataSchemas.expenses.safeParse(base).success).toBe(true);
    expect(
      reportDataSchemas.expenses.safeParse({ ...base, totals: { count: 0, amount: 0 } }).success,
    ).toBe(false);
  });
});
