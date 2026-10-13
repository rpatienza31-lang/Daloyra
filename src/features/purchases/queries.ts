import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/payment-methods";

/** Amounts are read as text (`::text`) so they never pass through a JS float. */
const OVERVIEW_COLUMNS =
  "id, reference_no, purchase_date, supplier_id, supplier_name, due_date, notes, created_at, voided_at, void_reason, payment_status, due_status, subtotal:subtotal::text, discount_amount:discount_amount::text, total:total::text, amount_paid:amount_paid::text, balance:balance::text";

export type PaymentStatus = "paid" | "partial" | "unpaid" | "voided";
export type DueStatus = "overdue" | "due_soon" | "not_due" | "no_due_date";

export interface PurchaseSummary {
  id: string;
  referenceNo: string;
  purchaseDate: string;
  supplierId: string | null;
  supplierName: string | null;
  dueDate: string | null;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  paymentStatus: PaymentStatus;
  dueStatus: DueStatus | null;
  subtotal: string;
  discount: string;
  total: string;
  amountPaid: string;
  balance: string;
}

export interface PurchaseItem {
  description: string;
  quantity: string;
  unitCost: string;
  lineTotal: string;
}

export interface PurchasePayment {
  id: string;
  paymentDate: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

interface OverviewRow {
  id: string | null;
  reference_no: string | null;
  purchase_date: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  due_date: string | null;
  notes: string | null;
  voided_at: string | null;
  void_reason: string | null;
  payment_status: string | null;
  due_status: string | null;
  subtotal: string | null;
  discount_amount: string | null;
  total: string | null;
  amount_paid: string | null;
  balance: string | null;
}

function toSummary(row: OverviewRow): PurchaseSummary {
  return {
    id: row.id ?? "",
    referenceNo: row.reference_no ?? "",
    purchaseDate: row.purchase_date ?? "",
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    dueDate: row.due_date,
    notes: row.notes,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    paymentStatus: (row.payment_status ?? "unpaid") as PaymentStatus,
    dueStatus: (row.due_status ?? null) as DueStatus | null,
    subtotal: row.subtotal ?? "0.00",
    discount: row.discount_amount ?? "0.00",
    total: row.total ?? "0.00",
    amountPaid: row.amount_paid ?? "0.00",
    balance: row.balance ?? "0.00",
  };
}

export type PurchaseFilter = "all" | "to_pay" | "paid" | "voided";

/** Purchases of the business, newest first, optionally filtered. */
export async function listPurchases(
  businessId: string,
  filter: PurchaseFilter,
  method: PaymentMethod | null,
): Promise<PurchaseSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("purchases_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("business_id", businessId)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (filter === "to_pay") query = query.gt("balance", 0);
  if (filter === "paid") query = query.eq("payment_status", "paid");
  if (filter === "voided") query = query.not("voided_at", "is", null);

  if (method) {
    // Purchases with at least one (non-voided) payment by this method.
    const { data: payments, error } = await supabase
      .from("supplier_payments")
      .select("purchase_id")
      .eq("business_id", businessId)
      .eq("method", method)
      .is("voided_at", null)
      .limit(1000);
    if (error) throw new Error("Could not load payments.", { cause: error });
    query = query.in("id", [...new Set(payments.map((p) => p.purchase_id))]);
  }

  const { data, error } = await query;
  if (error) throw new Error("Could not load purchases.", { cause: error });
  return data.map(toSummary);
}

/** Purchases with money still owed, earliest due first (SPEC Section 10, "To Collect"). */
export async function listPayables(
  businessId: string,
  supplierId?: string,
): Promise<PurchaseSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("purchases_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("business_id", businessId)
    .is("voided_at", null)
    .gt("balance", 0)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("purchase_date", { ascending: true });
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data, error } = await query;
  if (error) throw new Error("Could not load receivables.", { cause: error });
  return data.map(toSummary);
}

/** All purchases of one supplier, newest first. */
export async function listSupplierPurchases(
  businessId: string,
  supplierId: string,
): Promise<PurchaseSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("business_id", businessId)
    .eq("supplier_id", supplierId)
    .order("purchase_date", { ascending: false })
    .limit(200);
  if (error) throw new Error("Could not load purchases.", { cause: error });
  return data.map(toSummary);
}

/** Amount to Collect, summed in Postgres (SPEC 3.5). */
export async function getAmountToPay(businessId: string, supplierId?: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_amount_to_pay", {
    p_business_id: businessId,
    p_supplier_id: supplierId,
  });
  if (error) throw new Error("Could not load the amount to collect.", { cause: error });
  return data ?? "0.00";
}

export async function getPurchase(
  businessId: string,
  id: string,
): Promise<{
  purchase: PurchaseSummary;
  items: PurchaseItem[];
  payments: PurchasePayment[];
} | null> {
  const supabase = await createClient();
  const [overview, items, payments] = await Promise.all([
    supabase
      .from("purchases_overview")
      .select(OVERVIEW_COLUMNS)
      .eq("business_id", businessId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("purchase_items")
      .select(
        "description, quantity:quantity::text, unit_cost:unit_cost::text, line_total:line_total::text",
      )
      .eq("business_id", businessId)
      .eq("purchase_id", id)
      .order("position"),
    supabase
      .from("supplier_payments")
      .select("id, payment_date, amount:amount::text, method, reference, voided_at, void_reason")
      .eq("business_id", businessId)
      .eq("purchase_id", id)
      .order("payment_date")
      .order("created_at"),
  ]);
  if (overview.error || items.error || payments.error) {
    throw new Error("Could not load the purchase.", {
      cause: overview.error ?? items.error ?? payments.error,
    });
  }
  if (!overview.data) return null;

  return {
    purchase: toSummary(overview.data),
    items: items.data.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitCost: i.unit_cost,
      lineTotal: i.line_total ?? "0.00",
    })),
    payments: payments.data.map((p) => ({
      id: p.id,
      paymentDate: p.payment_date,
      amount: p.amount,
      method: p.method as PaymentMethod,
      reference: p.reference,
      voidedAt: p.voided_at,
      voidReason: p.void_reason,
    })),
  };
}

/** Active suppliers for the purchase form's picker. */
export async function listSupplierOptions(
  businessId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error("Could not load suppliers.", { cause: error });
  return data;
}

/** True once the business has any purchase. */
export async function hasAnyPurchases(businessId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (error) throw new Error("Could not check records.", { cause: error });
  return (count ?? 0) > 0;
}
