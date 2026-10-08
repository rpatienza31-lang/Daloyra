import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routes, safeNextPath } from "@/lib/routes";

/**
 * Landing point for links in Supabase emails (confirm signup, reset password).
 * Supports both link styles:
 *  - `?token_hash=…&type=…` (recommended email templates; works on any device)
 *  - `?code=…` (default templates; needs the same browser that asked for the link)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const isRecovery = type === "recovery" || params.get("next") === routes.resetPassword;
  const next = safeNextPath(
    params.get("next"),
    isRecovery ? routes.resetPassword : routes.onboarding,
  );

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    // Supabase only issues a code after confirming the email, so a signup link
    // opened in another browser has still confirmed the account.
    if (!isRecovery) redirect(`${routes.login}?message=email_confirmed`);
  }

  redirect(`${routes.login}?message=link_invalid`);
}
