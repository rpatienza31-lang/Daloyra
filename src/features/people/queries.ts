import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Person, PersonKind } from "./schema";

const TABLES = { customer: "customers", supplier: "suppliers" } as const;
const COLUMNS = "id, name, phone, email, address, notes, archived_at";

interface Row {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  archived_at: string | null;
}

function toPerson(row: Row): Person {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    archivedAt: row.archived_at,
  };
}

/** Customers or suppliers of the business, active or archived, by name. */
export async function listPeople(
  kind: PersonKind,
  businessId: string,
  archived: boolean,
): Promise<Person[]> {
  const supabase = await createClient();
  const query = supabase
    .from(TABLES[kind])
    .select(COLUMNS)
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  const { data, error } = archived
    ? await query.not("archived_at", "is", null)
    : await query.is("archived_at", null);
  if (error) throw new Error(`Could not load ${TABLES[kind]}.`, { cause: error });
  return data.map(toPerson);
}

export async function getPerson(
  kind: PersonKind,
  businessId: string,
  id: string,
): Promise<Person | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES[kind])
    .select(COLUMNS)
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load ${kind}.`, { cause: error });
  return data ? toPerson(data) : null;
}
