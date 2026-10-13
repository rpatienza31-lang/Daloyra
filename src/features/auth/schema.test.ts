import { describe, expect, it } from "vitest";
import { logInSchema, resetPasswordSchema, signUpSchema } from "./schema";

describe("signUpSchema", () => {
  it("cleans up the name and email", () => {
    const parsed = signUpSchema.parse({
      fullName: "  Maria Santos ",
      email: " Maria@Example.COM ",
      password: "kape-at-pandesal",
    });
    expect(parsed).toEqual({
      fullName: "Maria Santos",
      email: "maria@example.com",
      password: "kape-at-pandesal",
    });
  });

  it("rejects a short password and a bad email", () => {
    const result = signUpSchema.safeParse({ fullName: "Ana", email: "ana@", password: "1234567" });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("requires a name", () => {
    expect(
      signUpSchema.safeParse({ fullName: "  ", email: "a@b.co", password: "12345678" }).success,
    ).toBe(false);
  });
});

describe("logInSchema", () => {
  it("accepts any non-empty password (old accounts may have shorter ones)", () => {
    expect(logInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(logInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires both passwords to match", () => {
    const result = resetPasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "12345679",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(
      resetPasswordSchema.safeParse({ password: "12345678", confirmPassword: "12345678" }).success,
    ).toBe(true);
  });
});
