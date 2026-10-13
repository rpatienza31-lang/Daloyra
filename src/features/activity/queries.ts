import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_KINDS, changeSchema, type ActivityKind } from "./schema";

export interface ActivityEntry {
  id: string;
  createdAt: string;
  kind: ActivityKind;
  recordId: string;
  parentId: string | null;
  action: "create" | "update" | "void";
  actorName: string | null;
  label: string | null;
  /** Exact decimal text, as stored. */
  amount: string | null;
  reason: string | null;
  changes: { field: string; old: string | null; new: string | null }[];
}

export const ACTIVITY_PAGE = 50;

/** The audit log, newest first (owners only; Row Level Security enforces it). */
export async function listActivity(
  businessId: string,
  filters: { kind?: ActivityKind; before?: string; beforeId?: string },
): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_activity", {
    p_business_id: businessId,
    p_before: filters.before,
    p_limit: ACTIVITY_PAGE,
    p_table: filters.kind,
    p_before_id: filters.beforeId,
  });
  if (error) throw new Error("Could not load the activity.", { cause: error });
  return (data ?? []).flatMap((r) => {
    const kind = ACTIVITY_KINDS.find((k) => k === r.table_name);
    const action =
      r.action === "create" || r.action === "update" || r.action === "void" ? r.action : null;
    const changes = changeSchema.safeParse(r.changes);
    if (!kind || !action) return [];
    return [
      {
        id: r.id,
        createdAt: r.created_at,
        kind,
        recordId: r.record_id,
        parentId: r.parent_id,
        action,
        actorName: r.actor_name,
        label: r.label,
        amount: r.amount,
        reason: r.reason,
        changes: changes.success ? changes.data : [],
      },
    ];
  });
}
