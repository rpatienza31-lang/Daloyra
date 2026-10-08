import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/auth";
import { isRole, type Role } from "@/lib/permissions";

export interface CurrentBusiness {
  id: string;
  name: string;
  ownerName: string | null;
  currencyCode: string;
  timezone: string;
  logoPath: string | null;
  status: "active" | "suspended";
  role: Role;
}

/**
 * The signed-in user's business, resolved on the server from their membership
 * (never from anything the browser sends). One business per account in the MVP;
 * a business switcher would choose among memberships here.
 */
export const getCurrentBusiness = cache(async (): Promise<CurrentBusiness | null> => {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_members")
    .select(
      "role, business:businesses!inner(id, name, owner_name, currency_code, timezone, logo_path, status)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Could not load the business.", { cause: error });
  if (!data || !isRole(data.role)) return null;

  const b = data.business;
  return {
    id: b.id,
    name: b.name,
    ownerName: b.owner_name,
    currencyCode: b.currency_code,
    timezone: b.timezone,
    logoPath: b.logo_path,
    status: b.status === "suspended" ? "suspended" : "active",
    role: data.role,
  };
});

/** A short-lived link to the business logo (the bucket is private). */
export async function getLogoUrl(logoPath: string | null): Promise<string | null> {
  if (!logoPath) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("logos").createSignedUrl(logoPath, 60 * 60);
  return data?.signedUrl ?? null;
}

/** The signed-in user's name from their profile, if any. */
export async function getProfileName(): Promise<string | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name ?? null;
}
