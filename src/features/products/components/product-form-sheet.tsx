"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { saveProduct } from "../actions";
import { productSchema, type Product, type ProductInput } from "../schema";

const t = copy.products;
const f = copy.products.fields;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this product; omit to add a new one. */
  product?: Product;
}

export function ProductFormSheet({ open, onOpenChange, product }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={product ? t.edit : t.add}>
        {/* Remount per opening so an add always starts empty with a fresh id. */}
        {open ? <ProductForm product={product} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ProductForm({ product, onDone }: { product?: Product; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  // The client chooses the id so a retried save cannot create a duplicate.
  const [newId] = useState(() => crypto.randomUUID());
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      id: product?.id ?? newId,
      name: product?.name ?? "",
      unit: product?.unit ?? "pc",
      sellingPrice: product?.sellingPrice ?? "",
      purchasePrice: product?.purchasePrice ?? "",
      openingStock: "",
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveProduct(product ? "edit" : "add", values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(product ? copy.common.saved : t.added);
      onDone();
      if (product) router.refresh();
      else router.push(`/products/${values.id}`);
    });
  });

  const money = (id: "sellingPrice" | "purchasePrice", label: string, hint?: string) => (
    <FormField id={`product-${id}`} label={label} hint={hint} error={errors[id]?.message}>
      <Input
        id={`product-${id}`}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        className="amount"
        aria-invalid={Boolean(errors[id])}
        aria-describedby={describedBy(`product-${id}`, errors[id]?.message, hint)}
        {...form.register(id)}
      />
    </FormField>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <FormField id="product-name" label={f.name} error={errors.name?.message}>
        <Input
          id="product-name"
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("product-name", errors.name?.message)}
          {...form.register("name")}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        {money("sellingPrice", f.sellingPrice)}
        {money("purchasePrice", f.purchasePrice)}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">{f.purchasePriceHint}</p>
      <FormField id="product-unit" label={f.unit} hint={f.unitHint} error={errors.unit?.message}>
        <Input
          id="product-unit"
          autoComplete="off"
          aria-invalid={Boolean(errors.unit)}
          aria-describedby={describedBy("product-unit", errors.unit?.message, f.unitHint)}
          {...form.register("unit")}
        />
      </FormField>
      {product ? null : (
        <FormField
          id="product-openingStock"
          label={f.openingStock}
          optional
          hint={f.openingStockHint}
          error={errors.openingStock?.message}
        >
          <Input
            id="product-openingStock"
            inputMode="decimal"
            autoComplete="off"
            className="amount"
            aria-invalid={Boolean(errors.openingStock)}
            aria-describedby={describedBy(
              "product-openingStock",
              errors.openingStock?.message,
              f.openingStockHint,
            )}
            {...form.register("openingStock")}
          />
        </FormField>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? copy.common.saving : copy.common.save}
      </Button>
    </form>
  );
}
