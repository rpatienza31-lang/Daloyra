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
  createSaleSchema,
  paymentSchema,
  reasonSchema,
  saleErrorMessage,
  updateSaleSchema,
  type CreateSaleInput,
  type PaymentInput,
  type SaleItemInput,
  type UpdateSaleInput,
} from "./schema";

/**
 * Sale Server Actions. Each re-checks the session and role, validates with Zod, and
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

/** Canonical decimal strings for the database; descriptions default to "Sale". */
function itemsPayload(items: SaleItemInput[]) {
  return items.map((item) => ({
    description: item.description.trim() || copy.sales.defaultDescription,
    quantity: parseQuantityInput(item.quantity),
    unit_price: parseMoneyInput(item.unitPrice),
  }));
}

function dbError(error: { message: string; code?: string }, context: string): ActionResult {
  const message = saleErrorMessage(error.message);
  if (message === copy.common.unexpectedError)
    console.error(`${context} failed`, error.code, error.message);
  return fail(message);
}

function revalidateSales(saleId?: string) {
  revalidatePath("/sales", "layout");
  revalidatePath("/receivables");
  revalidatePath("/customers", "layout");
  revalidatePath("/dashboard");
  if (saleId) revalidatePath(`/sales/${saleId}`);
}

export async function createSale(input: CreateSaleInput): Promise<ActionResult> {
  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const business = await businessFor("money.record");
  if (isFailure(business)) return business;
  const sale = parsed.data;

  const payload = {
    id: sale.id,
    customer_id: sale.customerId || null,
    sale_date: sale.saleDate,
    reference_no: sale.referenceNo || null,
    discount_amount: parseMoneyInput(sale.discount || "0"),
    due_date: sale.paid === "full" ? null : sale.dueDate || null,
    notes: sale.notes || null,
    items: itemsPayload(sale.items),
    // "full" lets the database pay exactly the total it computes.
    payment:
      sale.paid === "none"
        ? null
        : {
            amount: sale.paid === "full" ? "full" : parseMoneyInput(sale.paidAmount),
            method: sale.method,
            payment_date: sale.saleDate,
          },
  } satisfies Json;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_sale", {
    p_business_id: business.id,
    p_sale: payload,
  });
  if (error) return dbError(error, "create_sale");

  revalidateSales();
  return ok;
}

export async function updateSale(input: UpdateSaleInput): Promise<ActionResult> {
  const parsed = updateSaleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const business = await businessFor("money.edit");
  if (isFailure(business)) return business;
  const sale = parsed.data;

  const payload = {
    id: sale.id,
    customer_id: sale.customerId || null,
    sale_date: sale.saleDate,
    reference_no: sale.referenceNo || null,
    discount_amount: parseMoneyInput(sale.discount || "0"),
    due_date: sale.dueDate || null,
    notes: sale.notes || null,
    items: itemsPayload(sale.items),
  } satisfies Json;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_sale", {
    p_business_id: business.id,
    p_sale: payload,
  });
  if (error) return dbError(error, "update_sale");

  revalidateSales(sale.id);
  return ok;
}

export async function voidSale(saleId: string, reason: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(saleId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return fail(copy.common.unexpectedError);
  if (!why.success) return fail(firstIssue(why.error));
  const business = await businessFor("money.void");
  if (isFailure(business)) return business;

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", {
    p_business_id: business.id,
    p_sale_id: id.data,
    p_reason: why.data,
  });
  if (error) return dbError(error, "void_sale");

  revalidateSales(id.data);
  return ok;
}

export async function recordPayment(input: PaymentInput): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const business = await businessFor("money.record");
  if (isFailure(business)) return business;
  const payment = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_customer_payment", {
    p_business_id: business.id,
    p_payment: {
      id: payment.id,
      sale_id: payment.saleId,
      amount: parseMoneyInput(payment.amount),
      method: payment.method,
      payment_date: payment.paymentDate,
      reference: payment.reference || null,
    },
  });
  if (error) return dbError(error, "record_customer_payment");

  revalidateSales(payment.saleId);
  return ok;
}

export async function voidPayment(
  paymentId: string,
  saleId: string,
  reason: string,
): Promise<ActionResult> {
  const id = z.uuid().safeParse(paymentId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return fail(copy.common.unexpectedError);
  if (!why.success) return fail(firstIssue(why.error));
  const business = await businessFor("money.void");
  if (isFailure(business)) return business;

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_customer_payment", {
    p_business_id: business.id,
    p_payment_id: id.data,
    p_reason: why.data,
  });
  if (error) {
    if (error.message === "customer_required") return fail(copy.sales.errors.walkInPaymentVoid);
    return dbError(error, "void_customer_payment");
  }

  revalidateSales(z.uuid().safeParse(saleId).success ? saleId : undefined);
  return ok;
}
