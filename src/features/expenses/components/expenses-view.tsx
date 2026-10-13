"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { MethodChips } from "@/components/money/method-chips";
import { MethodPill } from "@/components/money/method-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import { saveExpense, voidExpense } from "../actions";
import type { CategoryOption, Expense } from "../queries";
import { expenseSchema, type ExpenseInput } from "../schema";

const t = copy.expenses;

interface Props {
  expenses: Expense[];
  categories: CategoryOption[];
  currencyCode: string;
  today: string;
  hasAny: boolean;
  filters: { categoryId: string; method: string; showVoided: boolean };
  canRecord: boolean;
  canEdit: boolean;
  canVoid: boolean;
  canManageCategories: boolean;
  startAdding: boolean;
}

/** /expenses: list, filters, and create/edit in a side sheet (SPEC Section 10). */
export function ExpensesView(props: Props) {
  const { expenses, categories, currencyCode, hasAny, filters } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [adding, setAdding] = useState(props.startAdding && props.canRecord);
  const [selected, setSelected] = useState<Expense | null>(null);
  const money = (value: string) => formatMoney(value, currencyCode);

  const columns = useMemo<DataTableColumn<Expense>[]>(
    () => [
      {
        accessorKey: "expenseDate",
        header: t.date,
        cell: ({ row }) => formatDate(row.original.expenseDate),
      },
      { accessorKey: "categoryName", header: t.category },
      {
        accessorKey: "description",
        header: t.description,
        cell: ({ row }) => row.original.description ?? "—",
      },
      {
        accessorKey: "method",
        header: copy.sales.howPaid,
        enableSorting: false,
        cell: ({ row }) => <MethodPill method={row.original.method} />,
      },
      {
        accessorKey: "amount",
        header: t.amount,
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={cn("amount", row.original.voidedAt && "text-muted-foreground line-through")}
          >
            {formatMoney(row.original.amount, currencyCode)}
          </span>
        ),
      },
    ],
    [currencyCode],
  );

  function hrefWith(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("new");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const addButton = props.canRecord ? (
    <Button onClick={() => setAdding(true)}>
      <Plus aria-hidden />
      {t.add}
    </Button>
  ) : null;

  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} actions={addButton} />

      {!hasAny ? (
        <EmptyState icon={Receipt} title={t.emptyTitle} body={t.emptyBody} action={addButton} />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
            <div>
              <label htmlFor="category-filter" className="sr-only">
                {t.category}
              </label>
              <NativeSelect
                id="category-filter"
                value={filters.categoryId}
                onChange={(event) => router.push(hrefWith("category", event.target.value))}
              >
                <option value="">{t.allCategories}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <label htmlFor="method-filter" className="sr-only">
                {copy.sales.methodFilter}
              </label>
              <NativeSelect
                id="method-filter"
                value={filters.method}
                onChange={(event) => router.push(hrefWith("method", event.target.value))}
              >
                <option value="">{t.anyMethod}</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-[var(--brand)]"
                checked={filters.showVoided}
                onChange={(event) =>
                  router.push(hrefWith("voided", event.target.checked ? "1" : ""))
                }
              />
              {t.showVoided}
            </label>
          </div>
          {expenses.length === 0 ? (
            <p className="rounded-card border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              {t.emptyFiltered}
            </p>
          ) : (
            <DataTable
              columns={columns}
              data={expenses}
              getRowId={(e) => e.id}
              searchPlaceholder={t.searchPlaceholder}
              onRowClick={setSelected}
              renderCard={(e) => (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.description ?? e.categoryName}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.categoryName} · {formatDate(e.expenseDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "font-semibold text-money-out amount",
                        e.voidedAt && "text-muted-foreground line-through",
                      )}
                    >
                      −{money(e.amount)}
                    </span>
                    {e.voidedAt ? (
                      <Badge variant="muted" className="line-through">
                        {copy.sales.status.voided}
                      </Badge>
                    ) : (
                      <MethodPill method={e.method} />
                    )}
                  </div>
                </div>
              )}
            />
          )}
        </>
      )}

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent title={t.add}>
          {adding ? (
            <ExpenseForm
              mode="create"
              categories={categories}
              canManageCategories={props.canManageCategories}
              defaults={{
                id: crypto.randomUUID(),
                categoryId: "",
                expenseDate: props.today,
                description: "",
                amount: "",
                method: "cash",
                notes: "",
              }}
              onDone={() => setAdding(false)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent title={selected?.voidedAt || !props.canEdit ? t.title : t.edit}>
          {selected ? (
            <ExpenseDetail
              expense={selected}
              categories={categories}
              currencyCode={currencyCode}
              canEdit={props.canEdit}
              canVoid={props.canVoid}
              canManageCategories={props.canManageCategories}
              onDone={() => setSelected(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ExpenseDetail({
  expense,
  categories,
  currencyCode,
  canEdit,
  canVoid,
  canManageCategories,
  onDone,
}: {
  expense: Expense;
  categories: CategoryOption[];
  currencyCode: string;
  canEdit: boolean;
  canVoid: boolean;
  canManageCategories: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const voided = expense.voidedAt !== null;

  if (voided || !canEdit) {
    return (
      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t.amount}</dt>
          <dd className={cn("text-xl font-semibold amount", voided && "line-through")}>
            {formatMoney(expense.amount, currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.category}</dt>
          <dd>{expense.categoryName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.date}</dt>
          <dd>{formatDate(expense.expenseDate)}</dd>
        </div>
        {expense.description ? (
          <div>
            <dt className="text-muted-foreground">{t.description}</dt>
            <dd>{expense.description}</dd>
          </div>
        ) : null}
        <div>
          <MethodPill method={expense.method} />
        </div>
        {voided && expense.voidReason ? (
          <p className="text-muted-foreground">{copy.sales.voidedBy(expense.voidReason)}</p>
        ) : null}
      </dl>
    );
  }

  return (
    <>
      <ExpenseForm
        mode="edit"
        categories={categories}
        canManageCategories={canManageCategories}
        defaults={{
          id: expense.id,
          categoryId: expense.categoryId,
          expenseDate: expense.expenseDate,
          description: expense.description ?? "",
          amount: expense.amount,
          method: expense.method,
          notes: expense.notes ?? "",
        }}
        onDone={onDone}
      />
      {canVoid ? (
        <Button variant="outline" className="mt-6 w-full" onClick={() => setVoiding(true)}>
          <Ban aria-hidden />
          {t.voidAction}
        </Button>
      ) : null}
      <ReasonDialog
        open={voiding}
        onOpenChange={(open) => {
          setVoiding(open);
          if (!open) setVoidError(null);
        }}
        title={t.voidTitle}
        body={t.voidBody(formatMoney(expense.amount, currencyCode))}
        pending={pending}
        error={voidError}
        onConfirm={(reason) =>
          startTransition(async () => {
            const result = await voidExpense(expense.id, reason);
            if (!result.ok) {
              setVoidError(result.error);
              return;
            }
            setVoiding(false);
            toast.success(t.voided);
            onDone();
            router.refresh();
          })
        }
      />
    </>
  );
}

function ExpenseForm({
  mode,
  defaults,
  categories,
  canManageCategories,
  onDone,
}: {
  mode: "create" | "edit";
  defaults: ExpenseInput;
  categories: CategoryOption[];
  canManageCategories: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  // Archived categories stay selectable only for the expense that already uses them.
  const options = categories.filter((c) => !c.archived || c.id === defaults.categoryId);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveExpense(mode, values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(mode === "create" ? t.saved : t.updated);
      onDone();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}
      <FormField id="expense-amount" label={t.amount} error={errors.amount?.message}>
        <Input
          id="expense-amount"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={mode === "create"}
          placeholder="0.00"
          className="h-14 text-2xl font-semibold amount"
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={describedBy("expense-amount", errors.amount?.message)}
          {...form.register("amount")}
        />
      </FormField>
      <FormField id="expense-category" label={t.category} error={errors.categoryId?.message}>
        <NativeSelect
          id="expense-category"
          aria-invalid={Boolean(errors.categoryId)}
          aria-describedby={describedBy("expense-category", errors.categoryId?.message)}
          {...form.register("categoryId")}
        >
          <option value="">{t.chooseCategory}</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      {canManageCategories ? (
        <Link
          href="/settings/categories"
          className="-mt-3 self-start text-sm font-medium text-primary hover:underline"
        >
          {t.manageCategories}
        </Link>
      ) : null}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t.howPaid}</p>
        <Controller
          control={form.control}
          name="method"
          render={({ field }) => (
            <MethodChips
              id="expense-method"
              label={t.howPaid}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <FormField id="expense-date" label={t.date} error={errors.expenseDate?.message}>
        <Input id="expense-date" type="date" {...form.register("expenseDate")} />
      </FormField>
      <FormField
        id="expense-description"
        label={t.description}
        optional
        error={errors.description?.message}
      >
        <Input
          id="expense-description"
          placeholder={t.descriptionPlaceholder}
          autoComplete="off"
          {...form.register("description")}
        />
      </FormField>
      <FormField id="expense-notes" label={t.notes} optional error={errors.notes?.message}>
        <Textarea id="expense-notes" {...form.register("notes")} />
      </FormField>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? copy.common.saving : t.save}
      </Button>
    </form>
  );
}
