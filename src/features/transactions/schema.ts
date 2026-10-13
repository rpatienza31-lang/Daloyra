import { z } from "zod";
import { PAYMENT_METHOD_VALUES } from "@/lib/payment-methods";

export const TRANSACTION_TYPES = [
  "sale",
  "purchase",
  "customer_payment",
  "supplier_payment",
  "expense",
  "other_in",
  "other_out",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const STATUS_FILTERS = ["to_collect", "paid", "overdue", "voided", "active"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Filters of /transactions, read from the URL. Anything invalid is dropped, never trusted. */
export const transactionFiltersSchema = z.object({
  type: z.enum(TRANSACTION_TYPES).optional().catch(undefined),
  method: z.enum(PAYMENT_METHOD_VALUES).optional().catch(undefined),
  status: z.enum(STATUS_FILTERS).optional().catch(undefined),
  party: z.uuid().optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});
export type TransactionFilters = z.output<typeof transactionFiltersSchema>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "" ? undefined : v;
}

export function parseTransactionFilters(
  params: Record<string, string | string[] | undefined>,
): TransactionFilters {
  return transactionFiltersSchema.parse({
    type: first(params.type),
    method: first(params.method),
    status: first(params.status),
    party: first(params.party),
    from: first(params.from),
    to: first(params.to),
  });
}

/** Where a history row opens: the sale or purchase it belongs to, or the record itself. */
export function transactionHref(row: {
  type: TransactionType;
  id: string;
  documentId: string;
}): string {
  switch (row.type) {
    case "sale":
    case "customer_payment":
      return `/sales/${row.documentId}`;
    case "purchase":
    case "supplier_payment":
      return `/purchases/${row.documentId}`;
    case "expense":
      return `/expenses?open=${row.id}`;
    case "other_in":
    case "other_out":
      return `/money?open=${row.id}`;
  }
}
