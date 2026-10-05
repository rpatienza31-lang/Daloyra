import { describe, expect, it } from "vitest";
import { addDaysIso, periodRange, todayIn } from "./dates";

describe("todayIn", () => {
  it("uses Manila time, not UTC", () => {
    // 2026-10-04 16:30 UTC = 2026-10-05 00:30 in Manila (UTC+8)
    const now = new Date("2026-10-04T16:30:00Z");
    expect(todayIn("Asia/Manila", now)).toBe("2026-10-05");
    expect(todayIn("UTC", now)).toBe("2026-10-04");
  });
  it("is still the previous day just before Manila midnight", () => {
    const now = new Date("2026-10-04T15:59:59Z"); // 23:59:59 Manila
    expect(todayIn("Asia/Manila", now)).toBe("2026-10-04");
  });
});

describe("periodRange", () => {
  const now = new Date("2026-10-07T04:00:00Z"); // Wed 2026-10-07 in Manila

  it("today", () => {
    expect(periodRange("today", "Asia/Manila", now)).toEqual({
      from: "2026-10-07",
      to: "2026-10-07",
    });
  });
  it("weeks start on Monday", () => {
    expect(periodRange("this_week", "Asia/Manila", now)).toEqual({
      from: "2026-10-05",
      to: "2026-10-11",
    });
  });
  it("this month", () => {
    expect(periodRange("this_month", "Asia/Manila", now)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });
  it("this year", () => {
    expect(periodRange("this_year", "Asia/Manila", now)).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });
  it("month boundary in Manila", () => {
    const endOfSept = new Date("2026-09-30T16:00:00Z"); // 2026-10-01 00:00 Manila
    expect(periodRange("this_month", "Asia/Manila", endOfSept).from).toBe("2026-10-01");
  });
  it("February in a non-leap year", () => {
    const feb = new Date("2027-02-10T04:00:00Z");
    expect(periodRange("this_month", "Asia/Manila", feb).to).toBe("2027-02-28");
  });
});

describe("addDaysIso", () => {
  it("crosses month ends", () => {
    expect(addDaysIso("2026-10-31", 1)).toBe("2026-11-01");
  });
});
