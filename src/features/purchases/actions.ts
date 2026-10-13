"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { parseMoneyInput, parseQuantityInput } from "@/lib/money";
import { can, type Action } from "@/lib/permissions";
import { getCurrentBusiness, type CurrentBusiness } from "@/features/business/queries";
import type { Json } from "@/types/database";
import {
  createPurchaseSchema,
  paymentSchema,
  reasonSchema,
  purchaseErrorMessage,
  updatePurchaseSchema,
  type CreatePurchaseInput,
  type PaymentInput,
  type PurchaseItemInput,
  type UpdatePurchaseInput,
} from "./schema";

/**
 * Purchase Server Actions. Each re-checks the session and role, validates with Zod, and
 * calls one Postgres function that does the real work in a single transaction.
 * The business always comes from the user's membership, never from the browser.
 */

async function businessFor(
  action: Action,
): Promise<CurrentBusiness | { ok: false; error: string }> {
  const business = await getCurrentBusiness();
  if (!business) return fail(copy.auth.reset.noSession);
  if (!can(business.role, action) || business.status !== "active")
    return fail(copy.common.notAllowed);
  return business;
}

function isFailure(
  value: CurrentBusiness | { ok: false; error: string },
): value is { ok: false; error: string } {
  return "ok" in value;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? copy.common.unexpectedError;
}

/** Canonical decimal strings for the database; descriptions default to "Purchase". */
function itemsPayload(items: PurchaseItemInput[]) {
  return items.map((item) => ({
    description: item.description.trim() || copy.purchases.defaultDescription,
    quantity: parseQuantityInput(item.quantity),
    unit_cost: parseMoneyInput(item.unitCost),
  }));
}

function dbError(error: { message: string; code?: string }, context: string): ActionResult {
  const message = purchaseErrorMessage(error.message);
  if (message === copy.common.unexpectedError)
    console.error(`${context} failed`, error.code, error.message);
  return fail(message);
}

function revalidatePurchases(purchaseId?: string) {
  revalidatePath("/purchases", "layout");
  revalidatePath("/payables");
  revalidatePath("/suppliers", "layout");
  revalidatePath("/dashboard");
  if (purchaseId) revalidatePath(`/purchases/${purchaseId}`);
}

export async function createPurchase(input: CreatePurchaseInput): Promise<ActionResult> {
  const parsed = createPurchaseSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const business = await businessFor("money.record");
  if (isFailure(business)) return business;
  const purchase = parsed.data;

  const payload = {
    id: purchase.id,
    supplier_id: purchase.supplierId || null,
    purchase_date: purchase.purchaseDate,
    reference_no: purchase.referenceNo || null,
    discount_amount: parseMoneyInput(purchase.discount || "0"),
    due_date: purchase.paid === "full" ? null : purchase.dueDate || null,
    notes: purchase.notes || null,
    items: itemsPayload(purchase.items),
    // "full" lets the database pay exactly the total it computes.
    payment:
      purchase.paid === "none"
        ? null
        : {
            amount: purchase.paid === "full" ? "full" : parseMoneyInput(purchase.paidAmount),
            method: purchase.method,
            payment_date: purchase.purchaseDate,
          },
  } satisfies Json;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_purchase", {
    p_business_id: business.id,
    p_purchase: payload,
  });
  if (error) return dbError(error, "create_purchase");

  revalidatePurchases();
  return ok;
}

export async function updatePurchase(input: UpdatePurchaseInput): Promise<ActionResult> {
  const parsed = updatePurchaseSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const business = await businessFor("money.edit");
  if (isFailure(business)) return business;
  const purchase = parsed.data;

  const payload = {
    id: purchase.id,
    supplier_id: purchase.supplierId || null,
    purchase_date: purchase.purchaseDate,
    reference_no: purchase.referenceNo || null,
    discount_amount: parseMoneyInput(purchase.discount || "0"),
    due_date: purchase.dueDate || null,
    notes: purchase.notes || null,
    items: itemsPayload(purchase.items),
  } satisfies Json;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_purchase", {
    p_business_id: business.id,
    p_purchase: payload,
  });
  if (error) return dbError(error, "update_purchase");

  revalidatePurchases(purchase.id);
  return ok;
}

export async function voidPurchase(purchaseId: string, reason: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(purchaseId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return fail(copy.common.unexpectedError);
  if (!why.success) return fail(firstIssue(why.error));
  const business = await businessFor("money.void");
  if (isFailure(business)) return business;

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_purchase", {
    p_business_id: business.id,
    p_purchase_id: id.data,
    p_reason: why.data,
  });
  if (error) return dbError(error, "void_purchase");

  revalidatePurchases(id.data);
  return ok;
}

export async function recordPayment(input: PaymentInput): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const business = await businessFor("money.record");
  if (isFailure(business)) return business;
  const payment = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_supplier_payment", {
    p_business_id: business.id,
    p_payment: {
      id: payment.id,
      purchase_id: payment.purchaseId,
      amount: parseMoneyInput(payment.amount),
      method: payment.method,
      payment_date: payment.paymentDate,
      reference: payment.reference || null,
    },
  });
  if (error) return dbError(error, "record_supplier_payment");

  revalidatePurchases(payment.purchaseId);
  return ok;
}

export async function voidPayment(
  paymentId: string,
  purchaseId: string,
  reason: string,
): Promise<ActionResult> {
  const id = z.uuid().safeParse(paymentId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return fail(copy.common.unexpectedError);
  if (!why.success) return fail(firstIssue(why.error));
  const business = await businessFor("money.void");
  if (isFailure(business)) return business;

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_supplier_payment", {
    p_business_id: business.id,
    p_payment_id: id.data,
    p_reason: why.data,
  });
  if (error) {
    if (error.message === "supplier_required")
      return fail(copy.purchases.errors.noSupplierPaymentVoid);
    return dbError(error, "void_supplier_payment");
  }

  revalidatePurchases(z.uuid().safeParse(purchaseId).success ? purchaseId : undefined);
  return ok;
}
