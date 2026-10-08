import { describe, expect, it } from "vitest";
import { isPublicPath, isSignedOutOnlyPath, safeNextPath } from "./routes";

describe("route groups", () => {
  it("treats the landing and auth pages as public", () => {
    for (const path of ["/", "/login", "/signup", "/forgot-password", "/reset-password"]) {
      expect(isPublicPath(path)).toBe(true);
    }
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/login/")).toBe(true);
  });

  it("protects app pages", () => {
    for (const path of ["/dashboard", "/onboarding", "/sales/new", "/settings/business"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("sends signed-in users away from login and signup only", () => {
    expect(isSignedOutOnlyPath("/login")).toBe(true);
    expect(isSignedOutOnlyPath("/signup")).toBe(true);
    expect(isSignedOutOnlyPath("/reset-password")).toBe(false);
    expect(isSignedOutOnlyPath("/")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/sales?status=unpaid", "/dashboard")).toBe("/sales?status=unpaid");
    expect(safeNextPath("/onboarding", "/dashboard")).toBe("/onboarding");
  });

  it("rejects other sites and tricks", () => {
    for (const next of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(next, "/dashboard")).toBe("/dashboard");
    }
  });
});
