import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/lib/routes";

/**
 * The signed-in user's id, verified from the session token (not just read from the
 * cookie). Cached for the duration of one request.
 */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
});

/** For pages and actions that need a signed-in user. */
export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect(routes.login);
  return userId;
}

/** This site's origin, used to build links in emails (e.g. https://daloyra.vercel.app). */
export async function getSiteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
