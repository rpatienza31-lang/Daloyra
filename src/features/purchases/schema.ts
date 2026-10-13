import { z } from "zod";
import { copy } from "@/lib/copy";
import {
  compareMoney,
  lineTotal,
  parseMoneyInput,
  parseQuantityInput,
  subtractMoney,
  sumMoney,
} from "@/lib/money";
import { PAYMENT_METHOD_VALUES } from "@/lib/payment-methods";

/**
 * Purchase forms. These checks give instant, friendly feedback; the database re-checks
 * every rule and computes every saved total (SPEC Section 3).
 */

const e = copy.purchases.errors;

export const PAID_OPTIONS = ["full", "part", "none"] as const;
export type PaidOption = (typeof PAID_OPTIONS)[number];

const itemSchema = z.object({
  description: z.string().trim().max(200, copy.validation.tooLong(200)),
  quantity: z.string(),
  unitCost: z.string(),
});
export type PurchaseItemInput = z.input<typeof itemSchema>;

const basePurchaseSchema = z.object({
  id: z.uuid(),
  supplierId: z.union([z.uuid(), z.literal("")]),
  purchaseDate: z.iso.date(),
  referenceNo: z.string().trim().max(30, copy.validation.tooLong(30)),
  items: z.array(itemSchema).min(1).max(100),
  discount: z.string().trim(),
  dueDate: z.union([z.iso.date(), z.literal("")]),
  notes: z.string().trim().max(1000, copy.validation.tooLong(1000)),
});

export interface PurchaseTotals {
  lines: (string | null)[];
  subtotal: string;
  discount: string;
  total: string;
}

/**
 * Live preview of the totals, using the same rounding as the database. Never saved:
 * the database computes the stored figures itself.
 */
export function previewTotals(
  items: PurchaseItemInput[],
  discountRaw: string,
): PurchaseTotals | null {
  const lines = items.map((item) => {
    const quantity = parseQuantityInput(item.quantity);
    const price = parseMoneyInput(item.unitCost);
    return quantity && price ? lineTotal(quantity, price) : null;
  });
  const discount = parseMoneyInput(discountRaw === "" ? "0" : discountRaw);
  if (discount === null) return null;
  const subtotal = sumMoney(lines.filter((line): line is string => line !== null));
  return { lines, subtotal, discount, total: subtractMoney(subtotal, discount) };
}

type BasePurchase = z.infer<typeof basePurchaseSchema>;

function checkPurchase(purchase: BasePurchase, ctx: z.RefinementCtx): PurchaseTotals | null {
  purchase.items.forEach((item, index) => {
    if (parseQuantityInput(item.quantity) === null) {
      ctx.addIssue({
        code: "custom",
        message: e.quantityInvalid,
        path: ["items", index, "quantity"],
      });
    }
    if (parseMoneyInput(item.unitCost) === null) {
      ctx.addIssue({
        code: "custom",
        message: e.priceInvalid,
        path: ["items", index, "unitCost"],
      });
    }
  });
  const totals = previewTotals(purchase.items, purchase.discount);
  if (!totals) {
    ctx.addIssue({ code: "custom", message: copy.validation.amountInvalid, path: ["discount"] });
    return null;
  }
  if (compareMoney(totals.discount, totals.subtotal) > 0) {
    ctx.addIssue({ code: "custom", message: e.discountTooLarge, path: ["discount"] });
  } else if (compareMoney(totals.total, "0") <= 0) {
    ctx.addIssue({ code: "custom", message: e.amountRequired, path: ["total"] });
  }
  if (purchase.dueDate && purchase.dueDate < purchase.purchaseDate) {
    ctx.addIssue({ code: "custom", message: e.dueBeforePurchase, path: ["dueDate"] });
  }
  return totals;
}

export const createPurchaseSchema = basePurchaseSchema
  .extend({
    paid: z.enum(PAID_OPTIONS),
    paidAmount: z.string().trim(),
    method: z.enum(PAYMENT_METHOD_VALUES),
  })
  .superRefine((purchase, ctx) => {
    const totals = checkPurchase(purchase, ctx);
    if (purchase.paid !== "full" && purchase.supplierId === "") {
      ctx.addIssue({ code: "custom", message: e.supplierRequired, path: ["supplierId"] });
    }
    if (purchase.paid === "part") {
      const amount = parseMoneyInput(purchase.paidAmount);
      if (amount === null || compareMoney(amount, "0") <= 0) {
        ctx.addIssue({ code: "custom", message: e.amountRequired, path: ["paidAmount"] });
      } else if (totals && compareMoney(amount, totals.total) >= 0) {
        ctx.addIssue({ code: "custom", message: e.partTooLarge, path: ["paidAmount"] });
      }
    }
  });
export type CreatePurchaseInput = z.input<typeof createPurchaseSchema>;

export const updatePurchaseSchema = basePurchaseSchema.superRefine((purchase, ctx) => {
  checkPurchase(purchase, ctx);
});
export type UpdatePurchaseInput = z.input<typeof updatePurchaseSchema>;

export const paymentSchema = z.object({
  id: z.uuid(),
  purchaseId: z.uuid(),
  amount: z
    .string()
    .trim()
    .refine((value) => {
      const amount = parseMoneyInput(value);
      return amount !== null && compareMoney(amount, "0") > 0;
    }, e.amountRequired),
  method: z.enum(PAYMENT_METHOD_VALUES),
  paymentDate: z.iso.date(),
  reference: z.string().trim().max(100, copy.validation.tooLong(100)),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const reasonSchema = z
  .string()
  .trim()
  .min(1, e.reasonRequired)
  .max(300, copy.validation.tooLong(300));

/** Friendly text for the message keys raised by the purchase functions in Postgres. */
export function purchaseErrorMessage(key: string): string {
  const map: Record<string, string> = {
    overpayment: e.overpayment,
    total_below_paid: e.totalBelowPaid,
    supplier_required: e.supplierRequired,
    discount_too_large: e.discountTooLarge,
    reference_taken: e.referenceTaken,
    purchase_voided: e.purchaseVoided,
    not_found: e.notFound,
    supplier_not_found: e.supplierNotFound,
    payment_before_purchase: e.paymentBeforePurchase,
    invalid_amount: copy.validation.amountInvalid,
    invalid_quantity: e.quantityInvalid,
    items_required: e.amountRequired,
    reason_required: e.reasonRequired,
    not_allowed: copy.common.notAllowed,
  };
  return map[key] ?? copy.common.unexpectedError;
}
