"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";
import { getCurrentBusiness } from "@/features/business/queries";
import {
  PEOPLE_ROUTES,
  PERSON_KINDS,
  personSchema,
  type PersonInput,
  type PersonKind,
} from "./schema";

const TABLES = { customer: "customers", supplier: "suppliers" } as const;
const kindSchema = z.enum(PERSON_KINDS);

/**
 * Adds a customer/supplier, or edits one when `mode` is "edit". The business comes from
 * the user's membership, never from the browser. The id is chosen by the client, so a
 * retried add cannot create a duplicate.
 */
export async function savePerson(
  kind: PersonKind,
  mode: "add" | "edit",
  input: PersonInput,
): Promise<ActionResult> {
  const parsedKind = kindSchema.safeParse(kind);
  const parsed = personSchema.safeParse(input);
  if (!parsedKind.success || !parsed.success) {
    return fail(parsed.error?.issues[0]?.message ?? copy.common.unexpectedError);
  }

  const business = await getCurrentBusiness();
  if (!business) return fail(copy.auth.reset.noSession);
  const allowed =
    mode === "add" ? can(business.role, "people.add") : can(business.role, "people.edit");
  if (!allowed || business.status !== "active") return fail(copy.common.notAllowed);

  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const table = TABLES[parsedKind.data];

  if (mode === "add") {
    const { error } = await supabase
      .from(table)
      .insert({ id, business_id: business.id, ...fields });
    // 23505: the same id already exists, i.e. this is a retry of a save that worked.
    if (error && error.code !== "23505") {
      console.error(`${table} insert failed`, error.code, error.message);
      return fail(copy.common.unexpectedError);
    }
  } else {
    const { data, error } = await supabase
      .from(table)
      .update(fields)
      .eq("business_id", business.id)
      .eq("id", id)
      .select("id");
    if (error || data.length === 0) {
      if (error) console.error(`${table} update failed`, error.code, error.message);
      return fail(error ? copy.common.unexpectedError : copy.people.notFound);
    }
  }

  revalidatePath(PEOPLE_ROUTES[parsedKind.data], "layout");
  return ok;
}

export async function setPersonArchived(
  kind: PersonKind,
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const parsedKind = kindSchema.safeParse(kind);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedKind.success || !parsedId.success) return fail(copy.common.unexpectedError);

  const business = await getCurrentBusiness();
  if (!business) return fail(copy.auth.reset.noSession);
  if (!can(business.role, "people.edit") || business.status !== "active") {
    return fail(copy.common.notAllowed);
  }

  const supabase = await createClient();
  const table = TABLES[parsedKind.data];
  const { data, error } = await supabase
    .from(table)
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("business_id", business.id)
    .eq("id", parsedId.data)
    .select("id");
  if (error || data.length === 0) {
    if (error) console.error(`${table} archive failed`, error.code, error.message);
    return fail(error ? copy.common.unexpectedError : copy.people.notFound);
  }

  revalidatePath(PEOPLE_ROUTES[parsedKind.data], "layout");
  return ok;
}
