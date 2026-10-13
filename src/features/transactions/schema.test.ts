import { describe, expect, it } from "vitest";
import { parseTransactionFilters, transactionHref } from "./schema";

describe("parseTransactionFilters", () => {
  it("keeps valid filters", () => {
    expect(
      parseTransactionFilters({
        type: "expense",
        method: "gcash",
        status: "voided",
        party: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a11",
        from: "2026-10-01",
        to: "2026-10-31",
      }),
    ).toEqual({
      type: "expense",
      method: "gcash",
      status: "voided",
      party: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a11",
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("drops anything invalid or empty instead of failing", () => {
    expect(
      parseTransactionFilters({
        type: "refund",
        method: "bitcoin",
        status: "",
        party: "not-a-uuid",
        from: "2026-13-01",
        to: ["2026-10-31", "2026-11-30"],
      }),
    ).toEqual({ to: "2026-10-31" });
  });
});

describe("transactionHref", () => {
  const ids = { id: "p1", documentId: "d1" };
  it("opens payments on their sale or purchase", () => {
    expect(transactionHref({ ...ids, type: "customer_payment" })).toBe("/sales/d1");
    expect(transactionHref({ ...ids, type: "supplier_payment" })).toBe("/purchases/d1");
  });
  it("opens expenses and other money in their own list", () => {
    expect(transactionHref({ ...ids, type: "expense" })).toBe("/expenses?open=p1");
    expect(transactionHref({ ...ids, type: "other_out" })).toBe("/money?open=p1");
  });
});
