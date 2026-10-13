import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/payment-methods";
import type { Direction, EntryType } from "./schema";

export interface Entry {
  id: string;
  entryDate: string;
  direction: Direction;
  type: EntryType;
  amount: string;
  method: PaymentMethod;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

export async function listEntries(businessId: string): Promise<Entry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cash_adjustments")
    .select(
      "id, entry_date, direction, type, amount:amount::text, method, notes, voided_at, void_reason",
    )
    .eq("business_id", businessId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Could not load entries.", { cause: error });
  return data.map((e) => ({
    id: e.id,
    entryDate: e.entry_date,
    direction: e.direction as Direction,
    type: e.type as EntryType,
    amount: e.amount,
    method: e.method as PaymentMethod,
    notes: e.notes,
    voidedAt: e.voided_at,
    voidReason: e.void_reason,
  }));
}
