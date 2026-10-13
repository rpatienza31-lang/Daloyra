import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/payment-methods";

export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  expenseDate: string;
  description: string | null;
  amount: string;
  method: PaymentMethod;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  archived: boolean;
}

export async function listCategoryOptions(businessId: string): Promise<CategoryOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name, archived_at")
    .eq("business_id", businessId)
    .order("name");
  if (error) throw new Error("Could not load categories.", { cause: error });
  return data.map((c) => ({ id: c.id, name: c.name, archived: c.archived_at !== null }));
}

/** Expenses, newest first. Amounts are read as text. */
export async function listExpenses(
  businessId: string,
  filters: { categoryId: string | null; method: PaymentMethod | null; showVoided: boolean },
  categories: CategoryOption[],
): Promise<Expense[]> {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("business_id", businessId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.method) query = query.eq("method", filters.method);
  if (!filters.showVoided) query = query.is("voided_at", null);

  const { data, error } = await query;
  if (error) throw new Error("Could not load expenses.", { cause: error });
  return data.map((e) => toExpense(e, categories));
}

/** One expense, voided or not, e.g. when opened from the transaction history. */
export async function getExpense(
  businessId: string,
  id: string,
  categories: CategoryOption[],
): Promise<Expense | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load the expense.", { cause: error });
  return data ? toExpense(data, categories) : null;
}

const EXPENSE_COLUMNS =
  "id, category_id, expense_date, description, amount:amount::text, method, notes, voided_at, void_reason";

function toExpense(
  e: {
    id: string;
    category_id: string;
    expense_date: string;
    description: string | null;
    amount: string;
    method: string;
    notes: string | null;
    voided_at: string | null;
    void_reason: string | null;
  },
  categories: CategoryOption[],
): Expense {
  return {
    id: e.id,
    categoryId: e.category_id,
    categoryName: categories.find((c) => c.id === e.category_id)?.name ?? "",
    expenseDate: e.expense_date,
    description: e.description,
    amount: e.amount,
    method: e.method as PaymentMethod,
    notes: e.notes,
    voidedAt: e.voided_at,
    voidReason: e.void_reason,
  };
}

export async function hasAnyExpenses(businessId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (error) throw new Error("Could not check expenses.", { cause: error });
  return (count ?? 0) > 0;
}
