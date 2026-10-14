import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/payment-methods";

/** Amounts are read as text (`::text`) so they never pass through a JS float. */
const OVERVIEW_COLUMNS =
  "id, reference_no, sale_date, customer_id, customer_name, due_date, notes, created_at, voided_at, void_reason, payment_status, due_status, subtotal:subtotal::text, discount_amount:discount_amount::text, total:total::text, amount_paid:amount_paid::text, balance:balance::text";

export type PaymentStatus = "paid" | "partial" | "unpaid" | "voided";
export type DueStatus = "overdue" | "due_soon" | "not_due" | "no_due_date";

export interface SaleSummary {
  id: string;
  referenceNo: string;
  saleDate: string;
  customerId: string | null;
  customerName: string | null;
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

export interface SaleItem {
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface SalePayment {
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
  sale_date: string | null;
  customer_id: string | null;
  customer_name: string | null;
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

function toSummary(row: OverviewRow): SaleSummary {
  return {
    id: row.id ?? "",
    referenceNo: row.reference_no ?? "",
    saleDate: row.sale_date ?? "",
    customerId: row.customer_id,
    customerName: row.customer_name,
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

export type SaleFilter = "all" | "to_collect" | "paid" | "voided";

/** Sales of the business, newest first, optionally filtered. */
export async function listSales(
  businessId: string,
  filter: SaleFilter,
  method: PaymentMethod | null,
): Promise<SaleSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sales_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("business_id", businessId)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (filter === "to_collect") query = query.gt("balance", 0);
  if (filter === "paid") query = query.eq("payment_status", "paid");
  if (filter === "voided") query = query.not("voided_at", "is", null);

  if (method) {
    // Sales with at least one (non-voided) payment by this method.
    const { data: payments, error } = await supabase
      .from("customer_payments")
      .select("sale_id")
      .eq("business_id", businessId)
      .eq("method", method)
      .is("voided_at", null)
      .limit(1000);
    if (error) throw new Error("Could not load payments.", { cause: error });
    query = query.in("id", [...new Set(payments.map((p) => p.sale_id))]);
  }

  const { data, error } = await query;
  if (error) throw new Error("Could not load sales.", { cause: error });
  return data.map(toSummary);
}

/** Sales with money still owed, earliest due first (SPEC Section 10, "To Collect"). */
export async function listReceivables(
  businessId: string,
  customerId?: string,
): Promise<SaleSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sales_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("business_id", businessId)
    .is("voided_at", null)
    .gt("balance", 0)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("sale_date", { ascending: true });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data, error } = await query;
  if (error) throw new Error("Could not load receivables.", { cause: error });
  return data.map(toSummary);
}

/** Overdue sales, the longest overdue first (dashboard "Overdue to collect"). */
export async function listOverdue(businessId: string, limit: number): Promise<SaleSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("business_id", businessId)
    .is("voided_at", null)
    .eq("due_status", "overdue")
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) throw new Error("Could not load overdue sales.", { cause: error });
  return data.map(toSummary);
}

/** All sales of one customer, newest first. */
export async function listCustomerSales(
  businessId: string,
  customerId: string,
): Promise<SaleSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("sale_date", { ascending: false })
    .limit(200);
  if (error) throw new Error("Could not load sales.", { cause: error });
  return data.map(toSummary);
}

/** Amount to Collect, summed in Postgres (SPEC 3.5). */
export async function getAmountToCollect(businessId: string, customerId?: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_amount_to_collect", {
    p_business_id: businessId,
    p_customer_id: customerId,
  });
  if (error) throw new Error("Could not load the amount to collect.", { cause: error });
  return data ?? "0.00";
}

export async function getSale(
  businessId: string,
  id: string,
): Promise<{ sale: SaleSummary; items: SaleItem[]; payments: SalePayment[] } | null> {
  const supabase = await createClient();
  const [overview, items, payments] = await Promise.all([
    supabase
      .from("sales_overview")
      .select(OVERVIEW_COLUMNS)
      .eq("business_id", businessId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sale_items")
      .select(
        "product_id, description, quantity:quantity::text, unit_price:unit_price::text, line_total:line_total::text",
      )
      .eq("business_id", businessId)
      .eq("sale_id", id)
      .order("position"),
    supabase
      .from("customer_payments")
      .select("id, payment_date, amount:amount::text, method, reference, voided_at, void_reason")
      .eq("business_id", businessId)
      .eq("sale_id", id)
      .order("payment_date")
      .order("created_at"),
  ]);
  if (overview.error || items.error || payments.error) {
    throw new Error("Could not load the sale.", {
      cause: overview.error ?? items.error ?? payments.error,
    });
  }
  if (!overview.data) return null;

  return {
    sale: toSummary(overview.data),
    items: items.data.map((i) => ({
      productId: i.product_id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unit_price,
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

/** Active customers for the sale form's picker. */
export async function listCustomerOptions(
  businessId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error("Could not load customers.", { cause: error });
  return data;
}

/** True once the business has any sale (shows the first-sale empty state otherwise). */
export async function hasAnySales(businessId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (error) throw new Error("Could not check records.", { cause: error });
  return (count ?? 0) > 0;
}
