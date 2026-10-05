import { describe, expect, it } from "vitest";
import { formatMoney, lineTotal, parseMoneyInput, roundMoney, sumMoney } from "./money";

describe("roundMoney", () => {
  it("rounds half-up to 2 decimals", () => {
    expect(roundMoney("1.005")).toBe("1.01");
    expect(roundMoney("1.004")).toBe("1.00");
    expect(roundMoney("2.675")).toBe("2.68"); // float would give 2.67
  });
});

describe("lineTotal", () => {
  it("rounds per line with fractional quantities (SPEC 15)", () => {
    // 1.333 × 49.99 = 66.63667 → 66.64
    expect(lineTotal("1.333", "49.99")).toBe("66.64");
  });
  it("avoids float drift", () => {
    expect(lineTotal("3", "0.1")).toBe("0.30");
  });
});

describe("sumMoney", () => {
  it("adds exactly", () => {
    expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
    expect(sumMoney([])).toBe("0.00");
  });
});

describe("parseMoneyInput", () => {
  it("accepts common typed formats", () => {
    expect(parseMoneyInput("1,234.5")).toBe("1234.50");
    expect(parseMoneyInput("₱ 1234")).toBe("1234.00");
    expect(parseMoneyInput(" 12 ")).toBe("12.00");
  });
  it("rejects invalid input", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("-5")).toBeNull();
    expect(parseMoneyInput("1.234")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("1000000000000")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats pesos", () => {
    expect(formatMoney("1234.5")).toBe("₱1,234.50");
  });
  it("keeps precision on large values", () => {
    expect(formatMoney("999999999999.99")).toBe("₱999,999,999,999.99");
  });
  it("shows the sign on negatives", () => {
    expect(formatMoney("-50")).toBe("-₱50.00");
  });
});
