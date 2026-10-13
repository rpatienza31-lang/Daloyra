import { z } from "zod";
import { copy } from "@/lib/copy";
import { compareMoney, parseMoneyInput } from "@/lib/money";
import { PAYMENT_METHOD_VALUES } from "@/lib/payment-methods";

const amount = z
  .string()
  .trim()
  .refine((value) => {
    const parsed = parseMoneyInput(value);
    return parsed !== null && compareMoney(parsed, "0") > 0;
  }, copy.sales.errors.amountRequired);

export const expenseSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid({ error: copy.expenses.errors.categoryRequired }),
  expenseDate: z.iso.date({ error: copy.sales.errors.dateRequired }),
  description: z.string().trim().max(200, copy.validation.tooLong(200)),
  amount,
  method: z.enum(PAYMENT_METHOD_VALUES),
  notes: z.string().trim().max(1000, copy.validation.tooLong(1000)),
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export function expenseErrorMessage(key: string): string {
  const e = copy.expenses.errors;
  const map: Record<string, string> = {
    category_not_found: e.categoryNotFound,
    record_voided: e.recordVoided,
    not_found: e.notFound,
    invalid_amount: copy.validation.amountInvalid,
    reason_required: copy.sales.errors.reasonRequired,
    not_allowed: copy.common.notAllowed,
  };
  return map[key] ?? copy.common.unexpectedError;
}
