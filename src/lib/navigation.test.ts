import { describe, expect, it } from "vitest";
import { NAV_GROUPS, isActive } from "./navigation";

describe("isActive", () => {
  it("matches the page and pages below it", () => {
    expect(isActive("/customers", "/customers")).toBe(true);
    expect(isActive("/customers/abc", "/customers")).toBe(true);
    expect(isActive("/customers-old", "/customers")).toBe(false);
    expect(isActive("/settings/categories", "/settings")).toBe(true);
  });
});

describe("NAV_GROUPS", () => {
  it("follows the spec's grouping, with Stock added in Phase 9", () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([
      "Overview",
      "Money In",
      "Money Out",
      "People",
      "Stock",
      "Insights",
      "Settings",
    ]);
  });
});
