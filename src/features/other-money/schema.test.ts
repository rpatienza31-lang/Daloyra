import { describe, expect, it } from "vitest";
import { entrySchema } from "./schema";

const base = {
  id: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a11",
  entryDate: "2026-10-13",
  direction: "in" as const,
  type: "owner_in" as const,
  amount: "5000",
  method: "cash" as const,
  notes: "",
};

describe("entrySchema", () => {
  it("accepts a kind that fits the direction", () => {
    expect(entrySchema.safeParse(base).success).toBe(true);
    expect(entrySchema.safeParse({ ...base, direction: "out", type: "loan_out" }).success).toBe(
      true,
    );
    expect(entrySchema.safeParse({ ...base, type: "other" }).success).toBe(true);
  });

  it("rejects a kind that contradicts the direction", () => {
    expect(entrySchema.safeParse({ ...base, type: "owner_out" }).success).toBe(false);
    expect(entrySchema.safeParse({ ...base, direction: "out", type: "loan_in" }).success).toBe(
      false,
    );
  });
});
