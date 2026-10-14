"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldError,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, ListPlus, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { MethodChips } from "@/components/money/method-chips";
import { PersonFormSheet } from "@/features/people/components/person-form-sheet";
import { ProductSelect } from "@/features/products/components/product-select";
import type { ProductOption } from "@/features/products/schema";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createPurchase, updatePurchase } from "../actions";
import {
  PAID_OPTIONS,
  createPurchaseSchema,
  previewTotals,
  updatePurchaseSchema,
  type CreatePurchaseInput,
  type PaidOption,
} from "../schema";

const s = copy.purchases;

interface Props {
  mode: "create" | "edit";
  defaults: CreatePurchaseInput;
  suppliers: { id: string; name: string }[];
  /** Active products (plus any already on this purchase) for the product picker. */
  products: ProductOption[];
  currencyCode: string;
  canAddSupplier: boolean;
}

/**
 * Quick purchase first (amount → Save), with items, discount, supplier, date and payment
 * details one tap away (SPEC Section 9, flow 3). Totals shown here are previews only.
 */
export function PurchaseForm({
  mode,
  defaults,
  suppliers: initialSuppliers,
  products,
  currencyCode,
  canAddSupplier,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [addingSupplier, setAddingSupplier] = useState(false);
  // A supplier added from this form is selected once its option has rendered.
  const [newSupplierId, setNewSupplierId] = useState<string | null>(null);
  const firstItem = defaults.items[0];
  // With a product list, the purchase opens on its lines so products can be picked.
  const [itemsMode, setItemsMode] = useState(
    mode === "edit" ||
      products.length > 0 ||
      defaults.items.length > 1 ||
      (firstItem !== undefined && firstItem.quantity !== "1"),
  );
  const [showDetails, setShowDetails] = useState(mode === "edit");

  const form = useForm<CreatePurchaseInput>({
    resolver: (mode === "create"
      ? zodResolver(createPurchaseSchema)
      : zodResolver(updatePurchaseSchema)) as unknown as Resolver<CreatePurchaseInput>,
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const totalError = (errors as Record<string, FieldError | undefined>).total?.message;
  const items = useFieldArray({ control: form.control, name: "items" });

  const watchedItems = useWatch({ control: form.control, name: "items" });
  const discount = useWatch({ control: form.control, name: "discount" });
  const paid = useWatch({ control: form.control, name: "paid" });
  const totals = previewTotals(watchedItems ?? [], discount ?? "");
  const money = (value: string) => formatMoney(value, currencyCode);
  const needsSupplier = mode === "create" && paid !== "full";

  useEffect(() => {
    if (!newSupplierId) return;
    form.setValue("supplierId", newSupplierId, { shouldValidate: form.formState.isSubmitted });
  }, [newSupplierId, suppliers, form]);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result =
        mode === "create" ? await createPurchase(values) : await updatePurchase(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(mode === "create" ? s.saved : s.updated);
      router.push(`/purchases/${values.id}`);
    });
  });

  const supplierField = (
    <FormField id="supplierId" label={s.supplier} error={errors.supplierId?.message}>
      <div className="flex gap-2">
        <div className="flex-1">
          <NativeSelect
            id="supplierId"
            aria-invalid={Boolean(errors.supplierId)}
            aria-describedby={describedBy("supplierId", errors.supplierId?.message)}
            {...form.register("supplierId")}
          >
            <option value="">{s.noSupplier}</option>
            {suppliers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        {canAddSupplier ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={s.newSupplier}
            onClick={() => setAddingSupplier(true)}
          >
            <UserPlus aria-hidden />
          </Button>
        ) : null}
      </div>
    </FormField>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      {itemsMode ? (
        <section className="flex flex-col gap-3" aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-sm font-semibold">
            {s.items}
          </h2>
          <ul className="flex flex-col gap-3">
            {items.fields.map((field, index) => {
              const itemErrors = errors.items?.[index];
              const line = totals?.lines[index];
              return (
                <li key={field.id} className="rounded-card border border-border bg-card p-3">
                  {products.length > 0 ? (
                    <div className="mb-2">
                      <Controller
                        control={form.control}
                        name={`items.${index}.productId`}
                        render={({ field: productField }) => (
                          <ProductSelect
                            id={`items.${index}.productId`}
                            products={products}
                            value={productField.value ?? ""}
                            onChange={(picked) => {
                              productField.onChange(picked?.id ?? "");
                              if (!picked) return;
                              form.setValue(`items.${index}.description`, picked.name);
                              form.setValue(`items.${index}.unitCost`, picked.currentCost, {
                                shouldValidate: form.formState.isSubmitted,
                              });
                            }}
                          />
                        )}
                      />
                    </div>
                  ) : null}
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <label htmlFor={`items.${index}.description`} className="sr-only">
                        {s.description}
                      </label>
                      <Input
                        id={`items.${index}.description`}
                        placeholder={s.whatSoldPlaceholder}
                        autoComplete="off"
                        {...form.register(`items.${index}.description`)}
                      />
                    </div>
                    {items.fields.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`${s.removeItem} ${index + 1}`}
                        onClick={() => items.remove(index)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2 grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr_auto] sm:items-end">
                    <FormField
                      id={`items.${index}.quantity`}
                      label={s.quantity}
                      error={itemErrors?.quantity?.message}
                    >
                      <Input
                        id={`items.${index}.quantity`}
                        inputMode="decimal"
                        autoComplete="off"
                        className="amount"
                        aria-invalid={Boolean(itemErrors?.quantity)}
                        aria-describedby={describedBy(
                          `items.${index}.quantity`,
                          itemErrors?.quantity?.message,
                        )}
                        {...form.register(`items.${index}.quantity`)}
                      />
                    </FormField>
                    <FormField
                      id={`items.${index}.unitCost`}
                      label={s.unitCost}
                      error={itemErrors?.unitCost?.message}
                    >
                      <Input
                        id={`items.${index}.unitCost`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder={s.amountPlaceholder}
                        className="amount"
                        aria-invalid={Boolean(itemErrors?.unitCost)}
                        aria-describedby={describedBy(
                          `items.${index}.unitCost`,
                          itemErrors?.unitCost?.message,
                        )}
                        {...form.register(`items.${index}.unitCost`)}
                      />
                    </FormField>
                    <p className="col-span-2 text-right text-sm text-muted-foreground amount sm:col-span-1 sm:pb-3">
                      {line ? money(line) : "—"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() =>
              items.append({ productId: "", description: "", quantity: "1", unitCost: "" })
            }
          >
            <Plus aria-hidden />
            {s.addItem}
          </Button>
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          <FormField
            id="amount"
            label={s.amount}
            error={errors.items?.[0]?.unitCost?.message ?? totalError}
          >
            <Input
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder={s.amountPlaceholder}
              className="h-14 text-2xl font-semibold amount"
              aria-invalid={Boolean(errors.items?.[0]?.unitCost ?? totalError)}
              aria-describedby={describedBy(
                "amount",
                errors.items?.[0]?.unitCost?.message ?? totalError,
              )}
              {...form.register("items.0.unitCost")}
            />
          </FormField>
          <button
            type="button"
            onClick={() => setItemsMode(true)}
            className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline"
          >
            <ListPlus aria-hidden className="size-4" />
            {s.useItems}
          </button>
        </div>
      )}

      {totals && (itemsMode || (discount ?? "") !== "") ? (
        <dl className="rounded-card border border-border bg-card p-4 text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">{s.subtotal}</dt>
            <dd className="amount">{money(totals.subtotal)}</dd>
          </div>
          {totals.discount !== "0.00" ? (
            <div className="flex justify-between py-1">
              <dt className="text-muted-foreground">{s.discount}</dt>
              <dd className="amount">−{money(totals.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>{s.total}</dt>
            <dd className="amount">{money(totals.total)}</dd>
          </div>
          {itemsMode && totalError ? (
            <p className="mt-2 text-sm text-destructive">{totalError}</p>
          ) : null}
        </dl>
      ) : null}

      {mode === "create" ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-sm font-semibold">{s.didTheyPay}</legend>
          <Controller
            control={form.control}
            name="paid"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-label={s.didTheyPay}
                className="grid grid-cols-3 gap-1 rounded-control border border-border bg-card p-1"
              >
                {PAID_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={field.value === option}
                    onClick={() => field.onChange(option satisfies PaidOption)}
                    className={cn(
                      "min-h-11 rounded-[8px] px-2 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                      field.value === option
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {option === "full" ? s.paidFull : option === "part" ? s.paidPart : s.paidNone}
                  </button>
                ))}
              </div>
            )}
          />

          {paid === "part" ? (
            <FormField id="paidAmount" label={s.amountReceived} error={errors.paidAmount?.message}>
              <Input
                id="paidAmount"
                inputMode="decimal"
                autoComplete="off"
                placeholder={s.amountPlaceholder}
                className="amount"
                aria-invalid={Boolean(errors.paidAmount)}
                aria-describedby={describedBy("paidAmount", errors.paidAmount?.message)}
                {...form.register("paidAmount")}
              />
            </FormField>
          ) : null}

          {paid !== "none" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{s.howPaid}</p>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <MethodChips
                    id="method"
                    label={s.howPaid}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          ) : null}

          {needsSupplier ? (
            <>
              {supplierField}
              <FormField id="dueDate" label={s.dueDate} optional error={errors.dueDate?.message}>
                <Input
                  id="dueDate"
                  type="date"
                  aria-invalid={Boolean(errors.dueDate)}
                  aria-describedby={describedBy("dueDate", errors.dueDate?.message)}
                  {...form.register("dueDate")}
                />
              </FormField>
            </>
          ) : null}
        </fieldset>
      ) : null}

      {mode === "create" ? (
        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((v) => !v)}
          className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline"
        >
          {showDetails ? (
            <ChevronUp aria-hidden className="size-4" />
          ) : (
            <ChevronDown aria-hidden className="size-4" />
          )}
          {showDetails ? s.fewerDetails : s.moreDetails}
        </button>
      ) : null}

      {showDetails ? (
        <div className="flex flex-col gap-5">
          {!itemsMode ? (
            <FormField id="items.0.description" label={s.whatSold} optional>
              <Input
                id="items.0.description"
                placeholder={s.whatSoldPlaceholder}
                autoComplete="off"
                {...form.register("items.0.description")}
              />
            </FormField>
          ) : null}
          {needsSupplier ? null : supplierField}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="purchaseDate"
              label={s.date}
              error={errors.purchaseDate ? s.errors.dateRequired : undefined}
            >
              <Input id="purchaseDate" type="date" {...form.register("purchaseDate")} />
            </FormField>
            <FormField id="discount" label={s.discount} optional error={errors.discount?.message}>
              <Input
                id="discount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className="amount"
                aria-invalid={Boolean(errors.discount)}
                aria-describedby={describedBy("discount", errors.discount?.message)}
                {...form.register("discount")}
              />
            </FormField>
          </div>
          {mode === "edit" ? (
            <FormField id="dueDate" label={s.dueDate} optional error={errors.dueDate?.message}>
              <Input
                id="dueDate"
                type="date"
                aria-invalid={Boolean(errors.dueDate)}
                aria-describedby={describedBy("dueDate", errors.dueDate?.message)}
                {...form.register("dueDate")}
              />
            </FormField>
          ) : null}
          <FormField
            id="referenceNo"
            label={s.reference}
            optional
            hint={s.referenceHint}
            error={errors.referenceNo?.message}
          >
            <Input
              id="referenceNo"
              autoComplete="off"
              aria-describedby={describedBy(
                "referenceNo",
                errors.referenceNo?.message,
                s.referenceHint,
              )}
              {...form.register("referenceNo")}
            />
          </FormField>
          <FormField id="notes" label={s.notes} optional error={errors.notes?.message}>
            <Textarea id="notes" {...form.register("notes")} />
          </FormField>
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:self-start">
        {pending ? copy.common.saving : s.save}
      </Button>

      {canAddSupplier ? (
        <PersonFormSheet
          kind="supplier"
          open={addingSupplier}
          onOpenChange={setAddingSupplier}
          onSaved={(person) => {
            setSuppliers((list) => [...list, person].sort((a, b) => a.name.localeCompare(b.name)));
            setNewSupplierId(person.id);
          }}
        />
      ) : null}
    </form>
  );
}
