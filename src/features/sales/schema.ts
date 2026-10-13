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
 * Sale forms. These checks give instant, friendly feedback; the database re-checks
 * every rule and computes every saved total (SPEC Section 3).
 */

const e = copy.sales.errors;

export const PAID_OPTIONS = ["full", "part", "none"] as const;
export type PaidOption = (typeof PAID_OPTIONS)[number];

const itemSchema = z.object({
  description: z.string().trim().max(200, copy.validation.tooLong(200)),
  quantity: z.string(),
  unitPrice: z.string(),
});
export type SaleItemInput = z.input<typeof itemSchema>;

const baseSaleSchema = z.object({
  id: z.uuid(),
  customerId: z.union([z.uuid(), z.literal("")]),
  saleDate: z.iso.date(),
  referenceNo: z.string().trim().max(30, copy.validation.tooLong(30)),
  items: z.array(itemSchema).min(1).max(100),
  discount: z.string().trim(),
  dueDate: z.union([z.iso.date(), z.literal("")]),
  notes: z.string().trim().max(1000, copy.validation.tooLong(1000)),
});

export interface SaleTotals {
  lines: (string | null)[];
  subtotal: string;
  discount: string;
  total: string;
}

/**
 * Live preview of the totals, using the same rounding as the database. Never saved:
 * the database computes the stored figures itself.
 */
export function previewTotals(items: SaleItemInput[], discountRaw: string): SaleTotals | null {
  const lines = items.map((item) => {
    const quantity = parseQuantityInput(item.quantity);
    const price = parseMoneyInput(item.unitPrice);
    return quantity && price ? lineTotal(quantity, price) : null;
  });
  const discount = parseMoneyInput(discountRaw === "" ? "0" : discountRaw);
  if (discount === null) return null;
  const subtotal = sumMoney(lines.filter((line): line is string => line !== null));
  return { lines, subtotal, discount, total: subtractMoney(subtotal, discount) };
}

type BaseSale = z.infer<typeof baseSaleSchema>;

function checkSale(sale: BaseSale, ctx: z.RefinementCtx): SaleTotals | null {
  sale.items.forEach((item, index) => {
    if (parseQuantityInput(item.quantity) === null) {
      ctx.addIssue({
        code: "custom",
        message: e.quantityInvalid,
        path: ["items", index, "quantity"],
      });
    }
    if (parseMoneyInput(item.unitPrice) === null) {
      ctx.addIssue({
        code: "custom",
        message: e.priceInvalid,
        path: ["items", index, "unitPrice"],
      });
    }
  });
  const totals = previewTotals(sale.items, sale.discount);
  if (!totals) {
    ctx.addIssue({ code: "custom", message: copy.validation.amountInvalid, path: ["discount"] });
    return null;
  }
  if (compareMoney(totals.discount, totals.subtotal) > 0) {
    ctx.addIssue({ code: "custom", message: e.discountTooLarge, path: ["discount"] });
  } else if (compareMoney(totals.total, "0") <= 0) {
    ctx.addIssue({ code: "custom", message: e.amountRequired, path: ["total"] });
  }
  if (sale.dueDate && sale.dueDate < sale.saleDate) {
    ctx.addIssue({ code: "custom", message: e.dueBeforeSale, path: ["dueDate"] });
  }
  return totals;
}

export const createSaleSchema = baseSaleSchema
  .extend({
    paid: z.enum(PAID_OPTIONS),
    paidAmount: z.string().trim(),
    method: z.enum(PAYMENT_METHOD_VALUES),
  })
  .superRefine((sale, ctx) => {
    const totals = checkSale(sale, ctx);
    if (sale.paid !== "full" && sale.customerId === "") {
      ctx.addIssue({ code: "custom", message: e.customerRequired, path: ["customerId"] });
    }
    if (sale.paid === "part") {
      const amount = parseMoneyInput(sale.paidAmount);
      if (amount === null || compareMoney(amount, "0") <= 0) {
        ctx.addIssue({ code: "custom", message: e.amountRequired, path: ["paidAmount"] });
      } else if (totals && compareMoney(amount, totals.total) >= 0) {
        ctx.addIssue({ code: "custom", message: e.partTooLarge, path: ["paidAmount"] });
      }
    }
  });
export type CreateSaleInput = z.input<typeof createSaleSchema>;

export const updateSaleSchema = baseSaleSchema.superRefine((sale, ctx) => {
  checkSale(sale, ctx);
});
export type UpdateSaleInput = z.input<typeof updateSaleSchema>;

export const paymentSchema = z.object({
  id: z.uuid(),
  saleId: z.uuid(),
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

/** Friendly text for the message keys raised by the sale functions in Postgres. */
export function saleErrorMessage(key: string): string {
  const map: Record<string, string> = {
    overpayment: e.overpayment,
    total_below_paid: e.totalBelowPaid,
    customer_required: e.customerRequired,
    discount_too_large: e.discountTooLarge,
    reference_taken: e.referenceTaken,
    sale_voided: e.saleVoided,
    not_found: e.notFound,
    customer_not_found: e.customerNotFound,
    payment_before_sale: e.paymentBeforeSale,
    invalid_amount: copy.validation.amountInvalid,
    invalid_quantity: e.quantityInvalid,
    items_required: e.amountRequired,
    reason_required: e.reasonRequired,
    not_allowed: copy.common.notAllowed,
  };
  return map[key] ?? copy.common.unexpectedError;
}
