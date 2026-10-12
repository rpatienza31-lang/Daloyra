import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "./schema";

/** All expense categories of the business, active first, then by name. */
export async function listCategories(businessId: string): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name, is_default, archived_at")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw new Error("Could not load expense categories.", { cause: error });
  return data
    .map((row) => ({
      id: row.id,
      name: row.name,
      isDefault: row.is_default,
      archivedAt: row.archived_at,
    }))
    .sort((a, b) => Number(a.archivedAt !== null) - Number(b.archivedAt !== null));
}
