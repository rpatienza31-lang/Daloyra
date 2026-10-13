"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { genericAuthError } from "@/features/auth/errors";
import { resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/schema";
import { profileSchema, type ProfileInput } from "./schema";

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? copy.common.unexpectedError);
  const userId = await getUserId();
  if (!userId) return fail(copy.auth.reset.noSession);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", userId);
  if (error) {
    console.error("profile update failed", error.code, error.message);
    return fail(copy.common.unexpectedError);
  }
  revalidatePath("/settings/account");
  return ok;
}

/** Change password while logged in (the reset flow handles forgotten passwords). */
export async function changePassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? copy.common.unexpectedError);
  if (!(await getUserId())) return fail(copy.auth.reset.noSession);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail(copy.auth.reset.samePassword);
    if (error.code === "weak_password") return fail(copy.auth.signup.weakPassword);
    return fail(genericAuthError(error));
  }
  return ok;
}
