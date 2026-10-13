import { z } from "zod";
import { copy } from "@/lib/copy";
import { compareMoney, parseMoneyInput } from "@/lib/money";
import { PAYMENT_METHOD_VALUES } from "@/lib/payment-methods";

/** Values match the CHECK constraints on cash_adjustments. */
export const DIRECTIONS = ["in", "out"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const ENTRY_TYPES = ["owner_in", "owner_out", "loan_in", "loan_out", "other"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/** Which kinds fit each direction ("other" fits both). */
export const TYPES_FOR: Record<Direction, EntryType[]> = {
  in: ["owner_in", "loan_in", "other"],
  out: ["owner_out", "loan_out", "other"],
};

export const entrySchema = z
  .object({
    id: z.uuid(),
    entryDate: z.iso.date({ error: copy.sales.errors.dateRequired }),
    direction: z.enum(DIRECTIONS),
    type: z.enum(ENTRY_TYPES),
    amount: z
      .string()
      .trim()
      .refine((value) => {
        const parsed = parseMoneyInput(value);
        return parsed !== null && compareMoney(parsed, "0") > 0;
      }, copy.sales.errors.amountRequired),
    method: z.enum(PAYMENT_METHOD_VALUES),
    notes: z.string().trim().max(1000, copy.validation.tooLong(1000)),
  })
  .refine((entry) => TYPES_FOR[entry.direction].includes(entry.type), {
    message: copy.common.unexpectedError,
    path: ["type"],
  });
export type EntryInput = z.input<typeof entrySchema>;

export function entryErrorMessage(key: string): string {
  const e = copy.otherMoney.errors;
  const map: Record<string, string> = {
    record_voided: e.recordVoided,
    not_found: e.notFound,
    invalid_amount: copy.validation.amountInvalid,
    reason_required: copy.sales.errors.reasonRequired,
    not_allowed: copy.common.notAllowed,
  };
  return map[key] ?? copy.common.unexpectedError;
}
