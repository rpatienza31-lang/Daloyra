import { z } from "zod";
import { copy } from "@/lib/copy";

/** Customers and suppliers share one shape (SPEC Section 7.2). */
export const PERSON_KINDS = ["customer", "supplier"] as const;
export type PersonKind = (typeof PERSON_KINDS)[number];

const v = copy.validation;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, v.tooLong(max))
    .transform((value) => (value === "" ? null : value));

export const personSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, copy.people.nameRequired).max(120, v.tooLong(120)),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, v.emailInvalid)
    .refine((value) => value === "" || z.email().safeParse(value).success, v.emailInvalid)
    .transform((value) => (value === "" ? null : value)),
  address: optionalText(300),
  notes: optionalText(1000),
});
export type PersonInput = z.input<typeof personSchema>;
export type PersonValues = z.output<typeof personSchema>;

export interface Person {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  archivedAt: string | null;
}

export const PEOPLE_ROUTES: Record<PersonKind, string> = {
  customer: "/customers",
  supplier: "/suppliers",
};
