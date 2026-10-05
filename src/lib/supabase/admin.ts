import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Secret-key client that BYPASSES Row Level Security.
 * Only for the platform admin area (Phase 8). Never import from client code
 * and never use it for business data reads or writes.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set.");
  }
  return createClient(publicEnv.supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
