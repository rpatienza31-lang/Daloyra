import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD_VALUES, type PaymentMethod } from "@/lib/payment-methods";
import type { DueStatus, PaymentStatus } from "@/features/sales/queries";
import { TRANSACTION_TYPES, type TransactionFilters, type TransactionType } from "./schema";

/** One row of the unified history (`transactions_feed`). Amounts are decimal strings. */
export interface Transaction {
  id: string;
  type: TransactionType;
  documentId: string;
  date: string;
  partyId: string | null;
  partyName: string | null;
  reference: string | null;
  description: string | null;
  amount: string;
  moneyIn: string | null;
  moneyOut: string | null;
  method: PaymentMethod | null;
  /** paid / partial / unpaid for sales and purchases; recorded / voided for the rest. */
  status: PaymentStatus | "recorded";
  dueStatus: DueStatus | null;
  voidedAt: string | null;
}

export interface PartyOption {
  id: string;
  name: string;
  kind: "customer" | "supplier";
}

const FEED_COLUMNS =
  "id, type, document_id, date, party_id, party_name, reference, description, amount:amount::text, money_in:money_in::text, money_out:money_out::text, method, status, due_status, voided_at";

/** The history is capped; filters narrow it to older records. */
export const TRANSACTIONS_LIMIT = 500;

interface FeedRow {
  id: string | null;
  type: string | null;
  document_id: string | null;
  date: string | null;
  party_id: string | null;
  party_name: string | null;
  reference: string | null;
  description: string | null;
  amount: string | null;
  money_in: string | null;
  money_out: string | null;
  method: string | null;
  status: string | null;
  due_status: string | null;
  voided_at: string | null;
}

function toTransaction(r: FeedRow): Transaction | null {
  const type = TRANSACTION_TYPES.find((t) => t === r.type);
  if (!type || !r.id || !r.date) return null;
  const status = r.voided_at
    ? "voided"
    : r.status === "paid" || r.status === "partial" || r.status === "unpaid"
      ? r.status
      : "recorded";
  return {
    id: r.id,
    type,
    documentId: r.document_id ?? r.id,
    date: r.date,
    partyId: r.party_id,
    partyName: r.party_name,
    reference: r.reference,
    description: r.description,
    amount: r.amount ?? "0.00",
    moneyIn: r.money_in,
    moneyOut: r.money_out,
    method: PAYMENT_METHOD_VALUES.find((m) => m === r.method) ?? null,
    status,
    dueStatus: (r.due_status ?? null) as DueStatus | null,
    voidedAt: r.voided_at,
  };
}

/**
 * The unified history, newest first, filtered in Postgres.
 * `createdBy` limits it to one person's own entries (Staff, SPEC 8).
 */
export async function listTransactions(
  businessId: string,
  filters: TransactionFilters,
  options: { limit?: number; createdBy?: string } = {},
): Promise<Transaction[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transactions_feed")
    .select(FEED_COLUMNS)
    .eq("business_id", businessId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options.limit ?? TRANSACTIONS_LIMIT);

  if (options.createdBy) query = query.eq("created_by", options.createdBy);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.method) query = query.eq("method", filters.method);
  if (filters.party) query = query.eq("party_id", filters.party);
  if (filters.from) query = query.gte("date", filters.from);
  if (filters.to) query = query.lte("date", filters.to);
  switch (filters.status) {
    case "to_collect":
      query = query.in("status", ["unpaid", "partial"]).is("voided_at", null);
      break;
    case "paid":
      query = query.eq("status", "paid").is("voided_at", null);
      break;
    case "overdue":
      query = query.eq("due_status", "overdue").is("voided_at", null);
      break;
    case "voided":
      query = query.not("voided_at", "is", null);
      break;
    case "active":
      query = query.is("voided_at", null);
      break;
  }

  const { data, error } = await query;
  if (error) throw new Error("Could not load transactions.", { cause: error });
  return data.flatMap((r) => toTransaction(r) ?? []);
}

/** Customers and suppliers for the history filter, archived ones included. */
export async function listPartyOptions(businessId: string): Promise<PartyOption[]> {
  const supabase = await createClient();
  const [customers, suppliers] = await Promise.all([
    supabase.from("customers").select("id, name").eq("business_id", businessId).order("name"),
    supabase.from("suppliers").select("id, name").eq("business_id", businessId).order("name"),
  ]);
  if (customers.error || suppliers.error)
    throw new Error("Could not load customers and suppliers.", {
      cause: customers.error ?? suppliers.error,
    });
  return [
    ...customers.data.map((c) => ({ id: c.id, name: c.name, kind: "customer" as const })),
    ...suppliers.data.map((s) => ({ id: s.id, name: s.name, kind: "supplier" as const })),
  ];
}
