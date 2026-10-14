"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { parseMoneyInput, parseQuantityInput } from "@/lib/money";
import { can } from "@/lib/permissions";
import { getCurrentBusiness, type CurrentBusiness } from "@/features/business/queries";
import type { Json } from "@/types/database";
import {
  adjustmentSchema,
  productErrorMessage,
  productSchema,
  reasonSchema,
  type AdjustmentInput,
  type ProductInput,
} from "./schema";

/**
 * Product Server Actions: re-check the session and role, validate with Zod, then call one
 * Postgres function. The business always comes from the user's membership.
 */

async function manager(): Promise<CurrentBusiness | { ok: false; error: string }> {
  const business = await getCurrentBusiness();
  if (!business) return fail(copy.auth.reset.noSession);
  if (!can(business.role, "products.manage") || business.status !== "active")
    return fail(copy.common.notAllowed);
  return business;
}

function isFailure(
  value: CurrentBusiness | { ok: false; error: string },
): value is { ok: false; error: string } {
  return "ok" in value;
}

function dbError(error: { message: string; code?: string }, context: string): ActionResult {
  const message = productErrorMessage(error.message);
  if (message === copy.common.unexpectedError)
    console.error(`${context} failed`, error.code, error.message);
  return fail(message);
}

function revalidateProducts(id?: string) {
  revalidatePath("/products", "layout");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/products/${id}`);
}

export async function saveProduct(
  mode: "add" | "edit",
  input: ProductInput,
): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? copy.common.unexpectedError);
  const business = await manager();
  if (isFailure(business)) return business;
  const p = parsed.data;

  const payload = {
    id: p.id,
    name: p.name,
    unit: p.unit || "pc",
    selling_price: parseMoneyInput(p.sellingPrice || "0"),
    purchase_price: parseMoneyInput(p.purchasePrice || "0"),
    opening_stock: mode === "add" ? (parseQuantityInput(p.openingStock) ?? null) : null,
  } satisfies Json;

  const supabase = await createClient();
  const { error } =
    mode === "add"
      ? await supabase.rpc("create_product", { p_business_id: business.id, p_product: payload })
      : await supabase.rpc("update_product", { p_business_id: business.id, p_product: payload });
  if (error) return dbError(error, mode === "add" ? "create_product" : "update_product");

  revalidateProducts(p.id);
  return ok;
}

export async function setProductArchived(id: string, archived: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail(copy.common.unexpectedError);
  const business = await manager();
  if (isFailure(business)) return business;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_product_archived", {
    p_business_id: business.id,
    p_product_id: id,
    p_archived: archived,
  });
  if (error) return dbError(error, "set_product_archived");
  revalidateProducts(id);
  return ok;
}

export async function createStockAdjustment(input: AdjustmentInput): Promise<ActionResult> {
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? copy.common.unexpectedError);
  const business = await manager();
  if (isFailure(business)) return business;
  const a = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_stock_adjustment", {
    p_business_id: business.id,
    p_entry: {
      id: a.id,
      product_id: a.productId,
      reason: a.reason,
      direction: a.direction,
      quantity: parseQuantityInput(a.quantity),
      adjustment_date: a.adjustmentDate,
      notes: a.notes || null,
    } satisfies Json,
  });
  if (error) return dbError(error, "create_stock_adjustment");
  revalidateProducts(a.productId);
  return ok;
}

export async function voidStockAdjustment(
  productId: string,
  entryId: string,
  reason: string,
): Promise<ActionResult> {
  const ids = z
    .object({ productId: z.uuid(), entryId: z.uuid() })
    .safeParse({ productId, entryId });
  if (!ids.success) return fail(copy.common.unexpectedError);
  const parsedReason = reasonSchema.safeParse(reason);
  if (!parsedReason.success)
    return fail(parsedReason.error.issues[0]?.message ?? copy.common.unexpectedError);
  const business = await manager();
  if (isFailure(business)) return business;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_stock_adjustment", {
    p_business_id: business.id,
    p_entry_id: entryId,
    p_reason: parsedReason.data,
  });
  if (error) return dbError(error, "void_stock_adjustment");
  revalidateProducts(productId);
  return ok;
}
