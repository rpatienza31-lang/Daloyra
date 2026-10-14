import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductOption, StockMovement } from "./schema";

const COLUMNS =
  "id, name, unit, selling_price:selling_price::text, purchase_price:purchase_price::text, archived_at";

async function stockById(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_stock", { p_business_id: businessId });
  if (error) throw new Error("Could not load stock.", { cause: error });
  return new Map(data.map((row) => [row.product_id, row]));
}

/** Products of the business, active or archived, by name, with stock and cost. */
export async function listProducts(businessId: string, archived: boolean): Promise<Product[]> {
  const supabase = await createClient();
  const query = supabase
    .from("products")
    .select(COLUMNS)
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  const [{ data, error }, stock] = await Promise.all([
    archived ? query.not("archived_at", "is", null) : query.is("archived_at", null),
    stockById(businessId),
  ]);
  if (error) throw new Error("Could not load products.", { cause: error });
  return data.map((row) => {
    const s = stock.get(row.id);
    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      sellingPrice: row.selling_price,
      purchasePrice: row.purchase_price,
      archivedAt: row.archived_at,
      onHand: s?.on_hand ?? "0",
      currentCost: s?.current_cost ?? row.purchase_price,
      unitProfit: s?.unit_profit ?? "0.00",
    };
  });
}

export async function getProduct(businessId: string, id: string): Promise<Product | null> {
  const supabase = await createClient();
  const [{ data, error }, stock] = await Promise.all([
    supabase
      .from("products")
      .select(COLUMNS)
      .eq("business_id", businessId)
      .eq("id", id)
      .maybeSingle(),
    stockById(businessId),
  ]);
  if (error) throw new Error("Could not load the product.", { cause: error });
  if (!data) return null;
  const s = stock.get(data.id);
  return {
    id: data.id,
    name: data.name,
    unit: data.unit,
    sellingPrice: data.selling_price,
    purchasePrice: data.purchase_price,
    archivedAt: data.archived_at,
    onHand: s?.on_hand ?? "0",
    currentCost: s?.current_cost ?? data.purchase_price,
    unitProfit: s?.unit_profit ?? "0.00",
  };
}

/** Active products for the product picker on sale and purchase lines. */
export async function listProductOptions(businessId: string): Promise<ProductOption[]> {
  const products = await listProducts(businessId, false);
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    sellingPrice: p.sellingPrice,
    currentCost: p.currentCost,
    onHand: p.onHand,
  }));
}

export async function listStockMovements(
  businessId: string,
  productId: string,
): Promise<StockMovement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_movements", {
    p_business_id: businessId,
    p_product_id: productId,
  });
  if (error) throw new Error("Could not load the stock history.", { cause: error });
  return data.map((m) => ({
    id: m.id,
    kind: m.kind as StockMovement["kind"],
    documentId: m.document_id,
    date: m.date,
    reference: m.reference,
    quantity: m.quantity,
    unitAmount: m.unit_amount,
    reason: m.reason,
    notes: m.notes,
    voided: m.voided,
  }));
}

/**
 * The product options plus any product already on a document's lines that is no longer in
 * the list (archived), so editing the document keeps its lines' products.
 */
export function withDocumentProducts(
  options: ProductOption[],
  lines: { productId: string | null; description: string }[],
): ProductOption[] {
  const extra: ProductOption[] = [];
  for (const line of lines) {
    if (!line.productId) continue;
    if (options.some((o) => o.id === line.productId) || extra.some((o) => o.id === line.productId))
      continue;
    extra.push({
      id: line.productId,
      name: line.description,
      unit: "",
      sellingPrice: "0.00",
      currentCost: "0.00",
      onHand: "0",
    });
  }
  return [...options, ...extra];
}
