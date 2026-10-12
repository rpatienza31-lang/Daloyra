import { describe, expect, it } from "vitest";
import { createSaleSchema, previewTotals, updateSaleSchema, type CreateSaleInput } from "./schema";

const quick: CreateSaleInput = {
  id: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a11",
  customerId: "",
  saleDate: "2026-10-13",
  referenceNo: "",
  items: [{ description: "", quantity: "1", unitPrice: "150" }],
  discount: "",
  dueDate: "",
  notes: "",
  paid: "full",
  paidAmount: "",
  method: "cash",
};
const customer = "0b8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a22";

function issues(input: CreateSaleInput) {
  const result = createSaleSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("createSaleSchema", () => {
  it("accepts a quick sale with only an amount", () => {
    expect(issues(quick)).toEqual([]);
  });

  it("needs an amount greater than 0", () => {
    expect(
      issues({ ...quick, items: [{ description: "", quantity: "1", unitPrice: "0" }] }),
    ).toEqual(["total"]);
    expect(
      issues({ ...quick, items: [{ description: "", quantity: "1", unitPrice: "" }] }),
    ).toContain("items.0.unitPrice");
  });

  it("needs a customer when not paid in full (decision D4)", () => {
    expect(issues({ ...quick, paid: "none" })).toEqual(["customerId"]);
    expect(issues({ ...quick, paid: "none", customerId: customer })).toEqual([]);
  });

  it("needs a part payment between 0 and the total", () => {
    const part = { ...quick, paid: "part" as const, customerId: customer };
    expect(issues({ ...part, paidAmount: "" })).toEqual(["paidAmount"]);
    expect(issues({ ...part, paidAmount: "150" })).toEqual(["paidAmount"]);
    expect(issues({ ...part, paidAmount: "149.99" })).toEqual([]);
  });

  it("limits the discount to the subtotal", () => {
    expect(issues({ ...quick, discount: "150.01" })).toEqual(["discount"]);
    expect(issues({ ...quick, discount: "100" })).toEqual([]);
  });

  it("rejects a due date before the sale date", () => {
    expect(issues({ ...quick, paid: "none", customerId: customer, dueDate: "2026-10-12" })).toEqual(
      ["dueDate"],
    );
  });
});

describe("updateSaleSchema", () => {
  it("checks every item line", () => {
    const result = updateSaleSchema.safeParse({
      ...quick,
      items: [
        { description: "Rice", quantity: "1.333", unitPrice: "49.99" },
        { description: "Eggs", quantity: "0", unitPrice: "8.255" },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join("."))).toEqual([
      "items.1.quantity",
      "items.1.unitPrice",
    ]);
  });
});

describe("previewTotals", () => {
  it("matches the database's rounding per line", () => {
    expect(
      previewTotals(
        [
          { description: "Rice", quantity: "1.333", unitPrice: "49.99" },
          { description: "Eggs", quantity: "12", unitPrice: "8.25" },
        ],
        "0.64",
      ),
    ).toEqual({ lines: ["66.64", "99.00"], subtotal: "165.64", discount: "0.64", total: "165.00" });
  });
});
