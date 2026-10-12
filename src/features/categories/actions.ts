"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";
import { getCurrentBusiness, type CurrentBusiness } from "@/features/business/queries";
import { categorySchema, type CategoryInput } from "./schema";

const PATH = "/settings/categories";

async function requireManager(): Promise<
  { business: CurrentBusiness } | { failure: { ok: false; error: string } }
> {
  const business = await getCurrentBusiness();
  if (!business) return { failure: fail(copy.auth.reset.noSession) };
  if (!can(business.role, "categories.manage") || business.status !== "active") {
    return { failure: fail(copy.common.notAllowed) };
  }
  return { business };
}

/** Adds a category, or renames one when `mode` is "rename". */
export async function saveCategory(
  mode: "add" | "rename",
  input: CategoryInput,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? copy.common.unexpectedError);
  const auth = await requireManager();
  if ("failure" in auth) return auth.failure;

  const supabase = await createClient();
  const { id, name } = parsed.data;
  const { error } =
    mode === "add"
      ? await supabase
          .from("expense_categories")
          .insert({ id, business_id: auth.business.id, name })
      : await supabase
          .from("expense_categories")
          .update({ name })
          .eq("business_id", auth.business.id)
          .eq("id", id);

  if (error) {
    // 23505 on the id is a retried add that already worked; on the name it is a duplicate.
    if (error.code === "23505") {
      if (error.message.includes("expense_categories_pkey")) return ok;
      return fail(copy.settings.categories.duplicate);
    }
    console.error("expense_categories save failed", error.code, error.message);
    return fail(copy.common.unexpectedError);
  }

  revalidatePath(PATH);
  return ok;
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<ActionResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return fail(copy.common.unexpectedError);
  const auth = await requireManager();
  if ("failure" in auth) return auth.failure;

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("business_id", auth.business.id)
    .eq("id", parsedId.data);
  if (error) {
    console.error("expense_categories archive failed", error.code, error.message);
    return fail(copy.common.unexpectedError);
  }

  revalidatePath(PATH);
  return ok;
}
