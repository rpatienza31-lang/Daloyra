"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";
import { removeLogo, saveLogo } from "./logo";
import { getCurrentBusiness } from "./queries";
import { businessSettingsSchema, logoProblem } from "./schema";

const FIELDS = [
  "name",
  "ownerName",
  "businessType",
  "address",
  "contactNumber",
  "email",
  "currencyCode",
  "startingCash",
  "startingBalanceDate",
] as const;

/** Saves the business profile. Owner only (SPEC Section 8); RLS enforces the same. */
export async function updateBusinessSettings(formData: FormData): Promise<ActionResult> {
  const business = await getCurrentBusiness();
  if (!business) return fail(copy.auth.reset.noSession);
  if (!can(business.role, "business.manageSettings") || business.status !== "active") {
    return fail(copy.common.notAllowed);
  }

  const raw = Object.fromEntries(FIELDS.map((key) => [key, formData.get(key) ?? ""]));
  const parsed = businessSettingsSchema.safeParse(raw);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? copy.onboarding.errors.invalid);
  const values = parsed.data;
  const logo = formData.get("logo");
  const logoFile = logo instanceof File && logo.size > 0 ? logo : null;
  if (logoFile) {
    const problem = logoProblem(logoFile);
    if (problem) return fail(problem);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_business_settings", {
    p_business_id: business.id,
    p_name: values.name,
    p_owner_name: values.ownerName ?? "",
    p_business_type: values.businessType ?? "",
    p_address: values.address ?? "",
    p_contact_number: values.contactNumber ?? "",
    p_email: values.email ?? "",
    p_currency_code: values.currencyCode,
    p_starting_cash_balance: values.startingCash,
    p_starting_balance_date: values.startingBalanceDate,
  });
  if (error) {
    if (error.message === "date_in_future") return fail(copy.settings.business.dateInFuture);
    if (error.message === "not_allowed") return fail(copy.common.notAllowed);
    if (error.message === "currency_locked") return fail(copy.settings.business.currencyLocked);
    console.error("update_business_settings failed", error.code, error.message);
    return fail(copy.common.unexpectedError);
  }

  let logoOk = true;
  if (logoFile) logoOk = await saveLogo(business.id, logoFile);
  else if (formData.get("removeLogo") === "1") logoOk = await removeLogo(business.id);

  revalidatePath("/", "layout");
  return logoOk ? ok : fail(copy.onboarding.errors.logoFailed);
}
