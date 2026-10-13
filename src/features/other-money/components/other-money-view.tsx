"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight, Ban, Info, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { saveEntry, voidEntry } from "../actions";
import type { Entry } from "../queries";
import { DIRECTIONS, TYPES_FOR, entrySchema, type Direction, type EntryInput } from "../schema";

const t = copy.otherMoney;

function signed(entry: Entry, currencyCode: string) {
  return `${entry.direction === "in" ? "+" : "−"}${formatMoney(entry.amount, currencyCode)}`;
}

/** /money: Other Money In / Out (SPEC 2.1 #4). Changes cash, never profit. */
export function OtherMoneyView({
  entries,
  currencyCode,
  today,
  canRecord,
  canEdit,
  canVoid,
  startAdding,
}: {
  entries: Entry[];
  currencyCode: string;
  today: string;
  canRecord: boolean;
  canEdit: boolean;
  canVoid: boolean;
  startAdding: boolean;
}) {
  const [adding, setAdding] = useState(startAdding && canRecord);
  const [selected, setSelected] = useState<Entry | null>(null);

  const columns = useMemo<DataTableColumn<Entry>[]>(
    () => [
      {
        accessorKey: "entryDate",
        header: t.date,
        cell: ({ row }) => formatDate(row.original.entryDate),
      },
      { id: "type", accessorFn: (e) => t.types[e.type], header: t.type },
      {
        accessorKey: "method",
        header: t.method,
        enableSorting: false,
        cell: ({ row }) => <MethodPill method={row.original.method} />,
      },
      {
        accessorKey: "amount",
        header: t.amount,
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={cn(
              "font-medium amount",
              row.original.direction === "in" ? "text-money-in" : "text-money-out",
              row.original.voidedAt && "text-muted-foreground line-through",
            )}
          >
            {signed(row.original, currencyCode)}
          </span>
        ),
      },
    ],
    [currencyCode],
  );

  const addButton = canRecord ? (
    <Button onClick={() => setAdding(true)}>
      <Plus aria-hidden />
      {t.add}
    </Button>
  ) : null;

  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} actions={addButton} />
      {entries.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={t.emptyTitle}
          body={t.emptyBody}
          action={addButton}
        />
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          getRowId={(e) => e.id}
          onRowClick={setSelected}
          renderCard={(e) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.types[e.type]}</p>
                <p className="text-sm text-muted-foreground">{formatDate(e.entryDate)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    "font-semibold amount",
                    e.direction === "in" ? "text-money-in" : "text-money-out",
                    e.voidedAt && "text-muted-foreground line-through",
                  )}
                >
                  {signed(e, currencyCode)}
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

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent title={t.add}>
          {adding ? (
            <EntryForm
              mode="create"
              defaults={{
                id: crypto.randomUUID(),
                entryDate: today,
                direction: "in",
                type: "owner_in",
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
        <SheetContent title={selected?.voidedAt || !canEdit ? t.title : t.edit}>
          {selected ? (
            <EntryDetail
              entry={selected}
              currencyCode={currencyCode}
              canEdit={canEdit}
              canVoid={canVoid}
              onDone={() => setSelected(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function EntryDetail({
  entry,
  currencyCode,
  canEdit,
  canVoid,
  onDone,
}: {
  entry: Entry;
  currencyCode: string;
  canEdit: boolean;
  canVoid: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const voided = entry.voidedAt !== null;

  if (voided || !canEdit) {
    return (
      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t.types[entry.type]}</dt>
          <dd className={cn("text-xl font-semibold amount", voided && "line-through")}>
            {signed(entry, currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.date}</dt>
          <dd>{formatDate(entry.entryDate)}</dd>
        </div>
        <div>
          <MethodPill method={entry.method} />
        </div>
        {entry.notes ? <p className="whitespace-pre-line">{entry.notes}</p> : null}
        {voided && entry.voidReason ? (
          <p className="text-muted-foreground">{copy.sales.voidedBy(entry.voidReason)}</p>
        ) : null}
      </dl>
    );
  }

  return (
    <>
      <EntryForm
        mode="edit"
        defaults={{
          id: entry.id,
          entryDate: entry.entryDate,
          direction: entry.direction,
          type: entry.type,
          amount: entry.amount,
          method: entry.method,
          notes: entry.notes ?? "",
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
        body={t.voidBody(formatMoney(entry.amount, currencyCode))}
        pending={pending}
        error={voidError}
        onConfirm={(reason) =>
          startTransition(async () => {
            const result = await voidEntry(entry.id, reason);
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

function EntryForm({
  mode,
  defaults,
  onDone,
}: {
  mode: "create" | "edit";
  defaults: EntryInput;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<EntryInput>({ resolver: zodResolver(entrySchema), defaultValues: defaults });
  const { errors } = form.formState;
  const direction = useWatch({ control: form.control, name: "direction" });
  const type = useWatch({ control: form.control, name: "type" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveEntry(mode, values);
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
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t.direction}</legend>
        <Controller
          control={form.control}
          name="direction"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-label={t.direction}
              className="grid grid-cols-2 gap-1 rounded-control border border-border bg-card p-1"
            >
              {DIRECTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={field.value === d}
                  onClick={() => {
                    field.onChange(d satisfies Direction);
                    // Keep the kind consistent with the direction.
                    if (!TYPES_FOR[d].includes(type))
                      form.setValue("type", TYPES_FOR[d][0] ?? "other");
                  }}
                  className={cn(
                    "min-h-11 rounded-[8px] text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    field.value === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {d === "in" ? t.in : t.out}
                </button>
              ))}
            </div>
          )}
        />
      </fieldset>
      <FormField id="entry-type" label={t.type}>
        <NativeSelect id="entry-type" {...form.register("type")}>
          {TYPES_FOR[direction].map((k) => (
            <option key={k} value={k}>
              {t.types[k]}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      {type === "loan_out" ? (
        <p className="-mt-2 flex gap-2 rounded-control bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.interestHint}
        </p>
      ) : null}
      <FormField id="entry-amount" label={t.amount} error={errors.amount?.message}>
        <Input
          id="entry-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          className="h-14 text-2xl font-semibold amount"
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={describedBy("entry-amount", errors.amount?.message)}
          {...form.register("amount")}
        />
      </FormField>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t.method}</p>
        <Controller
          control={form.control}
          name="method"
          render={({ field }) => (
            <MethodChips
              id="entry-method"
              label={t.method}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <FormField id="entry-date" label={t.date} error={errors.entryDate?.message}>
        <Input id="entry-date" type="date" {...form.register("entryDate")} />
      </FormField>
      <FormField id="entry-notes" label={t.notes} optional error={errors.notes?.message}>
        <Textarea id="entry-notes" {...form.register("notes")} />
      </FormField>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? copy.common.saving : t.save}
      </Button>
    </form>
  );
}
