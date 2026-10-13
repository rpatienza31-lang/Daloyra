import type { AuthError } from "@supabase/supabase-js";
import { copy } from "@/lib/copy";

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "over_sms_send_rate_limit",
]);

export function isRateLimited(error: AuthError): boolean {
  return error.status === 429 || (error.code !== undefined && RATE_LIMIT_CODES.has(error.code));
}

/** Friendly text for an auth error we did not handle specifically. */
export function genericAuthError(error: AuthError): string {
  return isRateLimited(error) ? copy.common.rateLimited : copy.common.unexpectedError;
}
