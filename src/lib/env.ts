/**
 * Public environment values. These are safe in the browser bundle.
 * Next.js inlines NEXT_PUBLIC_* only when referenced literally, so keep these
 * as direct property accesses.
 */
export const publicEnv = {
  supabaseUrl: requireValue("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: requireValue(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};

function requireValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}
