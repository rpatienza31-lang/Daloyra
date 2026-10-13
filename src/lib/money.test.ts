import { describe, expect, it } from "vitest";
import {
  compareMoney,
  formatMoney,
  formatQuantity,
  sharePercent,
  lineTotal,
  parseMoneyInput,
  parseQuantityInput,
  roundMoney,
  subtractMoney,
  sumMoney,
} from "./money";

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

describe("parseQuantityInput", () => {
  it("accepts up to 3 decimals and thousands separators", () => {
    expect(parseQuantityInput("2")).toBe("2");
    expect(parseQuantityInput("1.333")).toBe("1.333");
    expect(parseQuantityInput("1,000.5")).toBe("1000.5");
  });

  it("rejects zero, negatives, 4 decimals and words", () => {
    for (const raw of ["0", "0.000", "-1", "1.0001", "two", ""]) {
      expect(parseQuantityInput(raw)).toBeNull();
    }
  });
});

describe("previews", () => {
  it("subtracts exactly", () => {
    expect(subtractMoney("0.3", "0.1")).toBe("0.20");
    expect(subtractMoney("165.66", "6.64")).toBe("159.02");
  });

  it("compares amounts", () => {
    expect(compareMoney("100.00", "100")).toBe(0);
    expect(compareMoney("100.01", "100")).toBe(1);
    expect(compareMoney("99.99", "100")).toBe(-1);
  });

  it("formats quantities without trailing zeros", () => {
    expect(formatQuantity("1.500")).toBe("1.5");
    expect(formatQuantity("12.000")).toBe("12");
  });

  it("matches the database line rounding", () => {
    expect(lineTotal("1.333", "49.99")).toBe("66.64");
    expect(lineTotal("0.333", "0.05")).toBe("0.02");
  });
});

describe("sharePercent", () => {
  it("rounds half-up to a whole percent", () => {
    expect(sharePercent("400.00", "999.99")).toBe("40%");
    expect(sharePercent("1", "8")).toBe("13%");
    expect(sharePercent("999.99", "999.99")).toBe("100%");
  });

  it("shows tiny shares as <1% and handles an empty total", () => {
    expect(sharePercent("0.01", "1000.00")).toBe("<1%");
    expect(sharePercent("0.00", "1000.00")).toBe("0%");
    expect(sharePercent("5.00", "0.00")).toBe("0%");
  });
});
