import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** Supabase client for Client Components. Uses the user's session; RLS applies. */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}
