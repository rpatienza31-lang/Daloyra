import type { Metadata } from "next";
import { ExpensesView } from "@/features/expenses/components/expenses-view";
import {
  getExpense,
  hasAnyExpenses,
  listCategoryOptions,
  listExpenses,
} from "@/features/expenses/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { todayIn } from "@/lib/dates";
import { PAYMENT_METHOD_VALUES } from "@/lib/payment-methods";
import { can } from "@/lib/permissions";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: `${copy.expenses.title} · ${copy.brand.name}` };

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const categories = await listCategoryOptions(business.id);
  const categoryId = categories.find((c) => c.id === params.category)?.id ?? null;
  const method = PAYMENT_METHOD_VALUES.find((m) => m === params.method) ?? null;
  const showVoided = params.voided === "1";

  const openId = typeof params.open === "string" && isUuid(params.open) ? params.open : null;

  const [expenses, hasAny, opened] = await Promise.all([
    listExpenses(business.id, { categoryId, method, showVoided }, categories),
    hasAnyExpenses(business.id),
    openId ? getExpense(business.id, openId, categories) : null,
  ]);

  return (
    <ExpensesView
      expenses={expenses}
      categories={categories}
      currencyCode={business.currencyCode}
      today={todayIn(business.timezone)}
      hasAny={hasAny}
      filters={{ categoryId: categoryId ?? "", method: method ?? "", showVoided }}
      canRecord={can(business.role, "money.record")}
      canEdit={can(business.role, "money.edit")}
      canVoid={can(business.role, "money.void")}
      canManageCategories={can(business.role, "categories.manage")}
      startAdding={params.new === "1"}
      opened={opened}
    />
  );
}
