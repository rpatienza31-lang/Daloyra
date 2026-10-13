import { describe, expect, it } from "vitest";
import { daysInRange, selectPeriod } from "./schema";

// 2026-10-13 23:30 in Manila is still 15:30 UTC on the same day.
const now = new Date("2026-10-13T15:30:00Z");

describe("selectPeriod", () => {
  it("defaults to this month in the business timezone", () => {
    expect(selectPeriod({}, "Asia/Manila", now)).toEqual({
      period: "this_month",
      from: "2026-10-01",
      to: "2026-10-31",
      invalid: false,
    });
  });

  it("uses Manila's date, not UTC's, for today", () => {
    // 16:30 UTC is already the 14th in Manila.
    const late = new Date("2026-10-13T16:30:00Z");
    expect(selectPeriod({ period: "today" }, "Asia/Manila", late)).toMatchObject({
      from: "2026-10-14",
      to: "2026-10-14",
    });
  });

  it("starts weeks on Monday", () => {
    expect(selectPeriod({ period: "this_week" }, "Asia/Manila", now)).toMatchObject({
      from: "2026-10-12",
      to: "2026-10-18",
    });
  });

  it("covers the whole year", () => {
    expect(selectPeriod({ period: "this_year" }, "Asia/Manila", now)).toMatchObject({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("accepts a valid custom range", () => {
    expect(
      selectPeriod({ period: "custom", from: "2025-09-30", to: "2025-10-01" }, "Asia/Manila", now),
    ).toEqual({ period: "custom", from: "2025-09-30", to: "2025-10-01", invalid: false });
  });

  it("falls back to this month for a backwards or broken custom range", () => {
    for (const params of [
      { period: "custom", from: "2025-10-02", to: "2025-10-01" },
      { period: "custom", from: "nope", to: "2025-10-01" },
      { period: "custom" },
    ]) {
      expect(selectPeriod(params, "Asia/Manila", now)).toMatchObject({
        period: "this_month",
        invalid: true,
      });
    }
  });

  it("ignores an unknown period", () => {
    expect(selectPeriod({ period: "forever" }, "Asia/Manila", now).period).toBe("this_month");
  });
});

describe("daysInRange", () => {
  it("counts both ends", () => {
    expect(daysInRange({ from: "2026-10-01", to: "2026-10-31" })).toBe(31);
    expect(daysInRange({ from: "2026-10-13", to: "2026-10-13" })).toBe(1);
    expect(daysInRange({ from: "2024-01-01", to: "2024-12-31" })).toBe(366);
  });
});
