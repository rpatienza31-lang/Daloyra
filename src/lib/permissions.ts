/**
 * Role permissions (SPEC Section 8). Every app-side check goes through `can()` so
 * Manager and Staff can be switched on later without touching every page.
 * Row Level Security enforces the same rules in the database; this only decides
 * what the interface offers.
 */

export const ROLES = ["owner", "manager", "staff"] as const;
export type Role = (typeof ROLES)[number];

export type Action =
  | "money.record"
  | "money.edit"
  | "money.void"
  | "people.view"
  | "people.add"
  | "people.edit"
  | "reports.view"
  | "dashboard.viewTotals"
  | "categories.manage"
  | "business.manageSettings"
  | "team.manage"
  | "subscription.view"
  | "auditLog.view";

const PERMISSIONS: Record<Action, readonly Role[]> = {
  "money.record": ["owner", "manager", "staff"],
  "money.edit": ["owner", "manager"],
  "money.void": ["owner", "manager"],
  "people.view": ["owner", "manager", "staff"],
  "people.add": ["owner", "manager", "staff"],
  "people.edit": ["owner", "manager"],
  "reports.view": ["owner", "manager"],
  "dashboard.viewTotals": ["owner", "manager"],
  "categories.manage": ["owner", "manager"],
  "business.manageSettings": ["owner"],
  "team.manage": ["owner"],
  "subscription.view": ["owner"],
  "auditLog.view": ["owner"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, action: Action): boolean {
  return role != null && PERMISSIONS[action].includes(role);
}
