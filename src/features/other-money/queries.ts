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

const ENTRY_COLUMNS =
  "id, entry_date, direction, type, amount:amount::text, method, notes, voided_at, void_reason";

/** One entry, e.g. when opened from the transaction history. */
export async function getEntry(businessId: string, id: string): Promise<Entry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cash_adjustments")
    .select(ENTRY_COLUMNS)
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load the entry.", { cause: error });
  return data ? toEntry(data) : null;
}

export async function listEntries(businessId: string): Promise<Entry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cash_adjustments")
    .select(ENTRY_COLUMNS)
    .eq("business_id", businessId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Could not load entries.", { cause: error });
  return data.map(toEntry);
}

function toEntry(e: {
  id: string;
  entry_date: string;
  direction: string;
  type: string;
  amount: string;
  method: string;
  notes: string | null;
  voided_at: string | null;
  void_reason: string | null;
}): Entry {
  return {
    id: e.id,
    entryDate: e.entry_date,
    direction: e.direction as Direction,
    type: e.type as EntryType,
    amount: e.amount,
    method: e.method as PaymentMethod,
    notes: e.notes,
    voidedAt: e.voided_at,
    voidReason: e.void_reason,
  };
}
