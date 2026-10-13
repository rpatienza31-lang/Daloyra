"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin, getUserId } from "@/lib/auth";
import { fail, failWith, ok, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { routes, safeNextPath } from "@/lib/routes";
import { genericAuthError, isRateLimited } from "./errors";
import {
  emailOnlySchema,
  logInSchema,
  resetPasswordSchema,
  signUpSchema,
  type EmailOnlyInput,
  type LogInInput,
  type ResetPasswordInput,
  type SignUpInput,
} from "./schema";

async function confirmLink(next: string): Promise<string> {
  return `${await getSiteOrigin()}${routes.authConfirm}?next=${encodeURIComponent(next)}`;
}

export async function signUp(input: SignUpInput): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? copy.common.unexpectedError);
  const { fullName, email, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await confirmLink(routes.onboarding),
      data: { full_name: fullName },
    },
  });

  if (error) {
    // Never reveal whether an email is already registered.
    if (error.code === "user_already_exists" || error.code === "email_exists") return ok;
    if (error.code === "weak_password") return fail(copy.auth.signup.weakPassword);
    return fail(genericAuthError(error));
  }

  // Only happens if email confirmation is switched off in Supabase.
  if (data.session) redirect(routes.onboarding);
  return ok;
}

export async function logIn(
  input: LogInInput,
  next?: string | null,
): Promise<ActionResult<"email_not_confirmed">> {
  const parsed = logInSchema.safeParse(input);
  if (!parsed.success) return fail(copy.auth.login.invalidCredentials);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return failWith(copy.auth.login.emailNotConfirmed, "email_not_confirmed");
    }
    if (error.code === "invalid_credentials") return fail(copy.auth.login.invalidCredentials);
    return fail(genericAuthError(error));
  }

  redirect(safeNextPath(next, routes.dashboard));
}

export async function resendConfirmation(input: EmailOnlyInput): Promise<ActionResult> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) return fail(copy.validation.emailInvalid);

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: await confirmLink(routes.onboarding) },
  });
  if (error && isRateLimited(error)) return fail(copy.common.rateLimited);
  return ok;
}

export async function requestPasswordReset(input: EmailOnlyInput): Promise<ActionResult> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) return fail(copy.validation.emailInvalid);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await confirmLink(routes.resetPassword),
  });
  // Same answer whether or not the account exists.
  if (error && isRateLimited(error)) return fail(copy.common.rateLimited);
  return ok;
}

export async function updatePassword(input: ResetPasswordInput): Promise<ActionResult> {
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

  redirect(routes.dashboard);
}

export async function logOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(routes.login);
}
