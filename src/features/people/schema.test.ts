import { describe, expect, it } from "vitest";
import { personSchema } from "./schema";

const base = {
  id: "8f8f0a5e-3c1b-4b8e-9a52-0d6c2b8f4a11",
  name: " Aling Nena ",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

describe("personSchema", () => {
  it("needs only a name; empty fields become null", () => {
    expect(personSchema.parse(base)).toEqual({
      id: base.id,
      name: "Aling Nena",
      phone: null,
      email: null,
      address: null,
      notes: null,
    });
  });

  it("rejects a blank name, a bad email and over-long notes", () => {
    expect(personSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(personSchema.safeParse({ ...base, email: "nena@" }).success).toBe(false);
    expect(personSchema.safeParse({ ...base, notes: "x".repeat(1001) }).success).toBe(false);
  });

  it("normalises the email", () => {
    expect(personSchema.parse({ ...base, email: " Nena@Mail.COM " }).email).toBe("nena@mail.com");
  });
});
