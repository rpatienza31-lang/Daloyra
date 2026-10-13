"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";
import { saveLogo } from "./logo";
import { logoProblem, onboardingSchema } from "./schema";

const FIELDS = [
  "businessId",
  "name",
  "ownerName",
  "businessType",
  "address",
  "contactNumber",
  "email",
  "currencyCode",
  "startingCash",
] as const;

/** Message keys raised by public.create_business, mapped to friendly text. */
const CREATE_BUSINESS_ERRORS: Record<string, string> = {
  business_already_exists: copy.onboarding.errors.alreadyExists,
  email_not_confirmed: copy.onboarding.errors.emailNotConfirmed,
  not_authenticated: copy.auth.reset.noSession,
  invalid_input: copy.onboarding.errors.invalid,
  invalid_timezone: copy.onboarding.errors.invalid,
};

/**
 * Onboarding: creates the business (one transaction in Postgres), then stores the
 * optional logo under `{business_id}/` in the private logos bucket.
 */
export async function createBusiness(formData: FormData): Promise<ActionResult> {
  if (!(await getUserId())) return fail(copy.auth.reset.noSession);

  const raw = Object.fromEntries(FIELDS.map((key) => [key, formData.get(key) ?? ""]));
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return fail(copy.onboarding.errors.invalid);
  const values = parsed.data;

  const logo = formData.get("logo");
  const logoFile = logo instanceof File && logo.size > 0 ? logo : null;
  if (logoFile) {
    const problem = logoProblem(logoFile);
    if (problem) return fail(problem);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_business", {
    p_business_id: values.businessId,
    p_name: values.name,
    p_owner_name: values.ownerName,
    p_business_type: values.businessType || undefined,
    p_address: values.address,
    p_contact_number: values.contactNumber,
    p_email: values.email,
    p_currency_code: values.currencyCode,
    p_starting_cash_balance: values.startingCash,
  });
  if (error) {
    console.error("create_business failed", error.code, error.message);
    return fail(CREATE_BUSINESS_ERRORS[error.message] ?? copy.common.unexpectedError);
  }

  if (logoFile && !(await saveLogo(values.businessId, logoFile))) {
    redirect(`${routes.dashboard}?notice=logo_failed`);
  }
  redirect(routes.dashboard);
}
