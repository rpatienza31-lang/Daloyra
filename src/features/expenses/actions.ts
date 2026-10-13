"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { parseMoneyInput } from "@/lib/money";
import { can, type Action } from "@/lib/permissions";
import { getCurrentBusiness } from "@/features/business/queries";
import { reasonSchema } from "@/features/sales/schema";
import { expenseErrorMessage, expenseSchema, type ExpenseInput } from "./schema";

async function businessFor(action: Action) {
  const business = await getCurrentBusiness();
  if (!business) return { failure: fail(copy.auth.reset.noSession) } as const;
  if (!can(business.role, action) || business.status !== "active") {
    return { failure: fail(copy.common.notAllowed) } as const;
  }
  return { business } as const;
}

function dbError(error: { message: string; code?: string }, context: string): ActionResult {
  const message = expenseErrorMessage(error.message);
  if (message === copy.common.unexpectedError)
    console.error(`${context} failed`, error.code, error.message);
  return fail(message);
}

function revalidateExpenses() {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function saveExpense(
  mode: "create" | "edit",
  input: ExpenseInput,
): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? copy.common.unexpectedError);
  const auth = await businessFor(mode === "create" ? "money.record" : "money.edit");
  if ("failure" in auth) return auth.failure ?? fail(copy.common.unexpectedError);
  const e = parsed.data;

  const payload = {
    id: e.id,
    category_id: e.categoryId,
    expense_date: e.expenseDate,
    description: e.description || null,
    amount: parseMoneyInput(e.amount),
    method: e.method,
    notes: e.notes || null,
  };
  const supabase = await createClient();
  const { error } =
    mode === "create"
      ? await supabase.rpc("create_expense", {
          p_business_id: auth.business.id,
          p_expense: payload,
        })
      : await supabase.rpc("update_expense", {
          p_business_id: auth.business.id,
          p_expense: payload,
        });
  if (error) return dbError(error, mode === "create" ? "create_expense" : "update_expense");

  revalidateExpenses();
  return ok;
}

export async function voidExpense(expenseId: string, reason: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(expenseId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return fail(copy.common.unexpectedError);
  if (!why.success) return fail(why.error.issues[0]?.message ?? copy.common.unexpectedError);
  const auth = await businessFor("money.void");
  if ("failure" in auth) return auth.failure ?? fail(copy.common.unexpectedError);

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_expense", {
    p_business_id: auth.business.id,
    p_expense_id: id.data,
    p_reason: why.data,
  });
  if (error) return dbError(error, "void_expense");

  revalidateExpenses();
  return ok;
}
