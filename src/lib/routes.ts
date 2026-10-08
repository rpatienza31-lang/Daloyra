/**
 * Route groups used by the proxy for optimistic redirects. The real checks happen
 * on the server in each layout and action, and in the database.
 */

export const routes = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  authConfirm: "/auth/confirm",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
} as const;

/** Pages for signed-out visitors only; signed-in users are sent to the dashboard. */
const SIGNED_OUT_ONLY = new Set<string>([routes.login, routes.signup, routes.forgotPassword]);

/** Pages anyone may open. */
const PUBLIC = new Set<string>([
  routes.home,
  routes.resetPassword,
  routes.authConfirm,
  "/privacy",
  "/terms",
  ...SIGNED_OUT_ONLY,
]);

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isSignedOutOnlyPath(pathname: string): boolean {
  return SIGNED_OUT_ONLY.has(normalize(pathname));
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC.has(normalize(pathname));
}

/**
 * A redirect target taken from a query string, accepted only if it is a path on
 * this site. Anything else (other sites, protocol-relative URLs) falls back.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(next, "https://daloyra.invalid");
    if (url.origin !== "https://daloyra.invalid") return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
