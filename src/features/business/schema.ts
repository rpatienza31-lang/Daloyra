import { z } from "zod";
import { copy } from "@/lib/copy";
import { parseMoneyInput } from "@/lib/money";

/** Values match the CHECK constraint on businesses.business_type. */
export const BUSINESS_TYPES = ["retail", "food", "online", "services", "other"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Currencies offered at setup. All use 2 decimal places, matching numeric(14,2). */
export const CURRENCIES = [
  { code: "PHP", label: "Philippine peso (₱)" },
  { code: "USD", label: "US dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British pound (£)" },
  { code: "SGD", label: "Singapore dollar (S$)" },
  { code: "HKD", label: "Hong Kong dollar (HK$)" },
  { code: "AUD", label: "Australian dollar (A$)" },
  { code: "CAD", label: "Canadian dollar (C$)" },
  { code: "AED", label: "UAE dirham (AED)" },
  { code: "MYR", label: "Malaysian ringgit (RM)" },
] as const;
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [
  (typeof CURRENCIES)[number]["code"],
  ...(typeof CURRENCIES)[number]["code"][],
];
export const DEFAULT_CURRENCY = "PHP";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const v = copy.validation;

/** Optional text: trimmed, empty becomes undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, v.tooLong(max))
    .transform((value) => (value === "" ? undefined : value))
    .optional();

export const basicsSchema = z.object({
  name: z.string().trim().min(1, v.businessNameRequired).max(120, v.tooLong(120)),
  ownerName: optionalText(120),
  businessType: z.union([z.enum(BUSINESS_TYPES), z.literal("")]).optional(),
});

export const contactSchema = z.object({
  address: optionalText(300),
  contactNumber: optionalText(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, v.emailInvalid)
    .refine((value) => value === "" || z.email().safeParse(value).success, v.emailInvalid)
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export const moneySchema = z.object({
  currencyCode: z.enum(CURRENCY_CODES),
  // Kept as a decimal string end to end; Postgres stores it as numeric(14,2).
  startingCash: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const amount = parseMoneyInput(value === "" ? "0" : value);
      if (amount === null) {
        ctx.addIssue({ code: "custom", message: v.amountInvalid });
        return z.NEVER;
      }
      return amount;
    }),
});

export const onboardingSchema = z.object({
  businessId: z.uuid(),
  ...basicsSchema.shape,
  ...contactSchema.shape,
  ...moneySchema.shape,
});
export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingValues = z.output<typeof onboardingSchema>;

/** Fields shown on each wizard step, in order. */
export const ONBOARDING_STEPS = [
  ["name", "ownerName", "businessType"],
  ["address", "contactNumber", "email"],
  ["currencyCode", "startingCash"],
] as const satisfies readonly (readonly (keyof OnboardingInput)[])[];

/** Checks a logo file's declared type and size (the server also checks its bytes). */
export function logoProblem(file: { type: string; size: number }): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return v.logoType;
  if (file.size > LOGO_MAX_BYTES) return v.logoSize;
  return null;
}
