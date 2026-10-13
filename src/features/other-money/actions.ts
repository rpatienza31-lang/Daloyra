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
import { entryErrorMessage, entrySchema, type EntryInput } from "./schema";

async function businessFor(action: Action) {
  const business = await getCurrentBusiness();
  if (!business) return { failure: fail(copy.auth.reset.noSession) } as const;
  if (!can(business.role, action) || business.status !== "active") {
    return { failure: fail(copy.common.notAllowed) } as const;
  }
  return { business } as const;
}

function dbError(error: { message: string; code?: string }, context: string): ActionResult {
  const message = entryErrorMessage(error.message);
  if (message === copy.common.unexpectedError)
    console.error(`${context} failed`, error.code, error.message);
  return fail(message);
}

function revalidateEntries() {
  revalidatePath("/money");
  revalidatePath("/dashboard");
}

export async function saveEntry(mode: "create" | "edit", input: EntryInput): Promise<ActionResult> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? copy.common.unexpectedError);
  const auth = await businessFor(mode === "create" ? "money.record" : "money.edit");
  if ("failure" in auth) return auth.failure ?? fail(copy.common.unexpectedError);
  const e = parsed.data;

  const payload = {
    id: e.id,
    entry_date: e.entryDate,
    direction: e.direction,
    type: e.type,
    amount: parseMoneyInput(e.amount),
    method: e.method,
    notes: e.notes || null,
  };
  const supabase = await createClient();
  const { error } =
    mode === "create"
      ? await supabase.rpc("create_cash_adjustment", {
          p_business_id: auth.business.id,
          p_entry: payload,
        })
      : await supabase.rpc("update_cash_adjustment", {
          p_business_id: auth.business.id,
          p_entry: payload,
        });
  if (error)
    return dbError(error, mode === "create" ? "create_cash_adjustment" : "update_cash_adjustment");

  revalidateEntries();
  return ok;
}

export async function voidEntry(entryId: string, reason: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(entryId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return fail(copy.common.unexpectedError);
  if (!why.success) return fail(why.error.issues[0]?.message ?? copy.common.unexpectedError);
  const auth = await businessFor("money.void");
  if ("failure" in auth) return auth.failure ?? fail(copy.common.unexpectedError);

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_cash_adjustment", {
    p_business_id: auth.business.id,
    p_entry_id: id.data,
    p_reason: why.data,
  });
  if (error) return dbError(error, "void_cash_adjustment");

  revalidateEntries();
  return ok;
}
