import { z } from "zod";
import { copy } from "@/lib/copy";
import { parseMoneyInput, parseQuantityInput } from "@/lib/money";

/**
 * Product and stock forms (Phase 9). The database re-checks every rule; prices and
 * quantities travel as decimal strings.
 */

const e = copy.products.errors;

const price = z
  .string()
  .trim()
  .refine((value) => value === "" || parseMoneyInput(value) !== null, e.priceInvalid);

export const productSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, e.nameRequired).max(120, copy.validation.tooLong(120)),
  unit: z.string().trim().max(20, copy.validation.tooLong(20)),
  sellingPrice: price,
  purchasePrice: price,
  openingStock: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^0+(\.0*)?$/.test(value) || parseQuantityInput(value) !== null,
      e.quantityInvalid,
    ),
});
export type ProductInput = z.input<typeof productSchema>;

export const ADJUSTMENT_REASONS = ["count", "damaged", "lost", "opening"] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const adjustmentSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  reason: z.enum(ADJUSTMENT_REASONS),
  direction: z.enum(["add", "remove"]),
  quantity: z
    .string()
    .trim()
    .refine((value) => parseQuantityInput(value) !== null, e.quantityInvalid),
  adjustmentDate: z.iso.date(),
  notes: z.string().trim().max(500, copy.validation.tooLong(500)),
});
export type AdjustmentInput = z.input<typeof adjustmentSchema>;

export const reasonSchema = z
  .string()
  .trim()
  .min(1, e.reasonRequired)
  .max(300, copy.validation.tooLong(300));

export interface Product {
  id: string;
  name: string;
  unit: string;
  sellingPrice: string;
  purchasePrice: string;
  archivedAt: string | null;
  /** Stock on hand as a decimal string; may be negative (D60). */
  onHand: string;
  /** The cost a sale saved today would use (D59). */
  currentCost: string;
  /** Selling price minus current cost, computed in the database. */
  unitProfit: string;
  /** Bought plus starting stock (D69). */
  received: string;
  sold: string;
  /** Stock counts, damaged and lost, signed. */
  adjusted: string;
  /** Purchase line totals plus starting stock at its cost. */
  costReceived: string;
  /** Cost received ÷ received; null when nothing was received. */
  averageCost: string | null;
  /** Qty on hand × selling price (0 when nothing is on hand). */
  currentValue: string;
}

/** What the sale and purchase forms need to offer a product on a line. */
export interface ProductOption {
  id: string;
  name: string;
  unit: string;
  sellingPrice: string;
  currentCost: string;
  onHand: string;
}

export interface StockMovement {
  id: string;
  kind: "sale" | "purchase" | "adjustment";
  documentId: string;
  date: string;
  reference: string | null;
  quantity: string;
  unitAmount: string | null;
  reason: string | null;
  notes: string | null;
  voided: boolean;
}

/** Friendly text for the message keys raised by the product functions in Postgres. */
export function productErrorMessage(key: string): string {
  const map: Record<string, string> = {
    product_name_taken: e.nameTaken,
    product_not_found: e.notFound,
    not_found: e.notFound,
    invalid_amount: e.priceInvalid,
    invalid_quantity: e.quantityInvalid,
    reason_required: e.reasonRequired,
    record_voided: copy.otherMoney.errors.recordVoided,
    not_allowed: copy.common.notAllowed,
  };
  return map[key] ?? copy.common.unexpectedError;
}
