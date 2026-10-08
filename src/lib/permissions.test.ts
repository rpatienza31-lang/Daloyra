import { describe, expect, it } from "vitest";
import { can, isRole } from "./permissions";

describe("can", () => {
  it("lets every role record money", () => {
    expect(can("owner", "money.record")).toBe(true);
    expect(can("manager", "money.record")).toBe(true);
    expect(can("staff", "money.record")).toBe(true);
  });

  it("keeps editing and voiding away from staff", () => {
    expect(can("manager", "money.void")).toBe(true);
    expect(can("staff", "money.edit")).toBe(false);
    expect(can("staff", "money.void")).toBe(false);
  });

  it("keeps profit totals and reports away from staff", () => {
    expect(can("staff", "dashboard.viewTotals")).toBe(false);
    expect(can("staff", "reports.view")).toBe(false);
  });

  it("gives business settings, team, plan and audit log to the owner only", () => {
    for (const action of [
      "business.manageSettings",
      "team.manage",
      "subscription.view",
      "auditLog.view",
    ] as const) {
      expect(can("owner", action)).toBe(true);
      expect(can("manager", action)).toBe(false);
      expect(can("staff", action)).toBe(false);
    }
  });

  it("lets managers manage categories", () => {
    expect(can("manager", "categories.manage")).toBe(true);
    expect(can("staff", "categories.manage")).toBe(false);
  });

  it("denies everything without a role", () => {
    expect(can(null, "money.record")).toBe(false);
    expect(can(undefined, "people.view")).toBe(false);
  });
});

describe("isRole", () => {
  it("accepts only known roles", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});
