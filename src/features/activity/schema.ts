import { z } from "zod";

export const ACTIVITY_KINDS = [
  "sales",
  "purchases",
  "customer_payments",
  "supplier_payments",
  "expenses",
  "cash_adjustments",
  "businesses",
  "products",
  "stock_adjustments",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const activityFiltersSchema = z.object({
  kind: z.enum(ACTIVITY_KINDS).optional().catch(undefined),
  before: z.iso.datetime({ offset: true }).optional().catch(undefined),
  beforeId: z.uuid().optional().catch(undefined),
});

export const changeSchema = z.array(
  z.object({ field: z.string(), old: z.string().nullable(), new: z.string().nullable() }),
);
