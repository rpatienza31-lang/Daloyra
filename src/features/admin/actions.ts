"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { activatePlanSchema, extendTrialSchema, setStatusSchema } from "./schema";

/** Postgres raises short keys; turn them into plain words. Anything else is generic. */
function adminError(message: string): string {
  const e = copy.admin.errors;
  const known: Record<string, string> = {
    not_on_trial: e.not_on_trial,
    reason_required: e.reason_required,
    not_found: e.not_found,
    not_allowed: copy.common.notAllowed,
  };
  return known[message] ?? copy.common.unexpectedError;
}

function done(businessId: string): ActionResult {
  revalidatePath("/admin");
  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/log");
  return ok;
}

// Every admin function checks public.platform_admins in the database itself; the session
// check here only gives a clean error for a signed-out browser.

export async function activateLifetime(input: unknown): Promise<ActionResult> {
  await requireUserId();
  const parsed = activatePlanSchema.safeParse(input);
  if (!parsed.success) return fail(copy.common.unexpectedError);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_activate_plan", {
    p_business_id: parsed.data.businessId,
    p_plan_code: "lifetime",
    p_note: parsed.data.note,
  });
  if (error) return fail(adminError(error.message));
  return done(parsed.data.businessId);
}

export async function extendTrial(input: unknown): Promise<ActionResult> {
  await requireUserId();
  const parsed = extendTrialSchema.safeParse(input);
  if (!parsed.success) return fail(copy.common.unexpectedError);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_extend_trial", {
    p_business_id: parsed.data.businessId,
    p_days: parsed.data.days,
    p_note: parsed.data.note,
  });
  if (error) return fail(adminError(error.message));
  return done(parsed.data.businessId);
}

export async function setBusinessStatus(input: unknown): Promise<ActionResult> {
  await requireUserId();
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return fail(copy.admin.errors.reason_required);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_business_status", {
    p_business_id: parsed.data.businessId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(adminError(error.message));
  return done(parsed.data.businessId);
}
