import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ACCESS_STATES, type AccessState } from "./schema";

/** One business as the platform admin sees it: no amounts, no records (SPEC 6.3). */
export interface AdminBusiness {
  id: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  businessType: string | null;
  createdAt: string;
  access: AccessState;
  planName: string | null;
  trialEndsAt: string | null;
  lastActivity: string | null;
  members: number;
  sales: number;
  purchases: number;
  expenses: number;
  customers: number;
  suppliers: number;
}

export interface AdminAction {
  createdAt: string;
  adminEmail: string;
  businessId: string | null;
  businessName: string;
  action: "activate_plan" | "extend_trial" | "suspend" | "reactivate";
  details: Record<string, unknown>;
}

export async function listBusinesses(): Promise<AdminBusiness[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_businesses");
  if (error) throw new Error("Could not load businesses.", { cause: error });
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    ownerName: b.owner_name,
    ownerEmail: b.owner_email,
    businessType: b.business_type,
    createdAt: b.created_at,
    access: ACCESS_STATES.find((a) => a === b.access) ?? "trial_ended",
    planName: b.plan_name,
    trialEndsAt: b.trial_ends_at,
    lastActivity: b.last_activity,
    members: Number(b.members),
    sales: Number(b.sales),
    purchases: Number(b.purchases),
    expenses: Number(b.expenses),
    customers: Number(b.customers),
    suppliers: Number(b.suppliers),
  }));
}

const ACTIONS = ["activate_plan", "extend_trial", "suspend", "reactivate"] as const;

export async function listActions(limit = 200): Promise<AdminAction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_actions", { p_limit: limit });
  if (error) throw new Error("Could not load the admin log.", { cause: error });
  return (data ?? []).flatMap((a) => {
    const action = ACTIONS.find((x) => x === a.action);
    if (!action) return [];
    return [
      {
        createdAt: a.created_at,
        adminEmail: a.admin_email,
        businessId: a.business_id,
        businessName: a.business_name,
        action,
        details: (a.details ?? {}) as Record<string, unknown>,
      },
    ];
  });
}
