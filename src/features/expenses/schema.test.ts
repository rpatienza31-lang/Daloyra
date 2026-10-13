import { describe, expect, it } from "vitest";
import { expenseSchema } from "./schema";

const base = {
  id: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a11",
  categoryId: "0b8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a22",
  expenseDate: "2026-10-13",
  description: "",
  amount: "1500.50",
  method: "cash" as const,
  notes: "",
};

describe("expenseSchema", () => {
  it("accepts an amount, a category and a date", () => {
    expect(expenseSchema.safeParse(base).success).toBe(true);
  });

  it("needs a category and an amount above 0 with at most 2 decimals", () => {
    expect(expenseSchema.safeParse({ ...base, categoryId: "" }).success).toBe(false);
    for (const amount of ["0", "", "-5", "10.005"]) {
      expect(expenseSchema.safeParse({ ...base, amount }).success).toBe(false);
    }
  });
});
