import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Acts as the signed-in user, so Row Level Security always applies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
