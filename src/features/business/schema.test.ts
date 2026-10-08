import { describe, expect, it } from "vitest";
import { logoProblem, onboardingSchema } from "./schema";

const base = {
  businessId: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a11",
  name: "  Aling Nena's Store ",
  ownerName: "",
  businessType: "",
  address: "",
  contactNumber: "",
  email: "",
  currencyCode: "PHP",
  startingCash: "",
};

describe("onboardingSchema", () => {
  it("needs only the business name; everything else has a default", () => {
    const parsed = onboardingSchema.parse(base);
    expect(parsed.name).toBe("Aling Nena's Store");
    expect(parsed.ownerName).toBeUndefined();
    expect(parsed.email).toBeUndefined();
    expect(parsed.startingCash).toBe("0.00");
  });

  it("keeps starting cash as an exact decimal string", () => {
    expect(onboardingSchema.parse({ ...base, startingCash: "₱ 12,345.5" }).startingCash).toBe(
      "12345.50",
    );
    expect(onboardingSchema.parse({ ...base, startingCash: "0.1" }).startingCash).toBe("0.10");
  });

  it("rejects bad starting cash", () => {
    for (const startingCash of ["-5", "1.005", "abc", "1e3", "1000000000000"]) {
      expect(onboardingSchema.safeParse({ ...base, startingCash }).success).toBe(false);
    }
  });

  it("rejects a blank name, a bad email, and unknown options", () => {
    expect(onboardingSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...base, email: "shop@" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...base, currencyCode: "BTC" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...base, businessType: "casino" }).success).toBe(false);
  });

  it("normalises the business email", () => {
    expect(onboardingSchema.parse({ ...base, email: " Shop@Example.com " }).email).toBe(
      "shop@example.com",
    );
  });
});

describe("logoProblem", () => {
  it("accepts small PNG, JPG and WebP images", () => {
    expect(logoProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(logoProblem({ type: "image/webp", size: 2 * 1024 * 1024 })).toBeNull();
  });

  it("rejects SVG and large files", () => {
    expect(logoProblem({ type: "image/svg+xml", size: 100 })).not.toBeNull();
    expect(logoProblem({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).not.toBeNull();
  });
});
