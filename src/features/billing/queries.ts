import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const accessSchema = z.object({
  access: z.enum(["trial", "trial_ended", "paid", "suspended"]),
  plan_code: z.string(),
  plan_name: z.string(),
  trial_ends_at: z.string().nullable(),
  days_left: z.number().nullable(),
  price: z.string().nullable(),
  limits: z.record(z.string(), z.unknown()),
});

export interface Access {
  access: "trial" | "trial_ended" | "paid" | "suspended";
  planCode: string;
  planName: string;
  trialEndsAt: string | null;
  daysLeft: number | null;
  /** The one-time price as a decimal string, e.g. "599.00". */
  price: string;
  /** Plan limits (plans.limits); a missing key means no limit. */
  limits: Record<string, unknown>;
}

/** What the business may do right now: trial, ended trial, paid or paused. From Postgres. */
export const getAccess = cache(async (businessId: string): Promise<Access | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_access", { p_business_id: businessId });
  if (error) throw new Error("Could not load the plan.", { cause: error });
  const parsed = accessSchema.safeParse(data);
  if (!parsed.success) return null;
  const a = parsed.data;
  return {
    access: a.access,
    planCode: a.plan_code,
    planName: a.plan_name,
    trialEndsAt: a.trial_ends_at,
    daysLeft: a.days_left,
    price: a.price ?? "599.00",
    limits: a.limits,
  };
});

/** Entitlement check against plans.limits (SPEC 14, Phase 8). Unknown keys allow. */
export function isAllowed(access: Access | null, key: "exports"): boolean {
  if (!access || (access.access !== "trial" && access.access !== "paid")) return false;
  return access.limits[key] !== false;
}

export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) return false;
  return data === true;
});

/** The one-time Lifetime price as a decimal string, read from the plans table. */
export const getLifetimePrice = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("price:price::text")
    .eq("code", "lifetime")
    .maybeSingle();
  return data?.price ?? "599.00";
});
