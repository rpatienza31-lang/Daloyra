"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { createStockAdjustment } from "../actions";
import { adjustmentSchema, type AdjustmentInput } from "../schema";

const a = copy.products.adjust;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  unit: string;
  today: string;
}

export function AdjustStockSheet({ open, onOpenChange, productId, unit, today }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={a.title}>
        {open ? (
          <AdjustForm
            productId={productId}
            unit={unit}
            today={today}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function AdjustForm({
  productId,
  unit,
  today,
  onDone,
}: {
  productId: string;
  unit: string;
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [newId] = useState(() => crypto.randomUUID());
  const form = useForm<AdjustmentInput>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      id: newId,
      productId,
      reason: "count",
      direction: "add",
      quantity: "",
      adjustmentDate: today,
      notes: "",
    },
  });
  const { errors } = form.formState;
  const reason = useWatch({ control: form.control, name: "reason" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createStockAdjustment(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(a.saved);
      onDone();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <FormField id="adjust-reason" label={a.reason}>
        <NativeSelect id="adjust-reason" {...form.register("reason")}>
          {(["count", "damaged", "lost", "opening"] as const).map((r) => (
            <option key={r} value={r}>
              {copy.products.reasons[r]}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      {reason === "count" ? (
        <Controller
          control={form.control}
          name="direction"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{a.direction}</p>
              <div
                role="radiogroup"
                aria-label={a.direction}
                className="grid grid-cols-2 gap-1 rounded-control border border-border bg-card p-1"
              >
                {(["add", "remove"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={field.value === d}
                    onClick={() => field.onChange(d)}
                    className={cn(
                      "min-h-11 rounded-[8px] px-2 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                      field.value === d
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {d === "add" ? a.add : a.remove}
                  </button>
                ))}
              </div>
            </div>
          )}
        />
      ) : null}

      <FormField
        id="adjust-quantity"
        label={`${a.quantity} (${unit})`}
        error={errors.quantity?.message}
      >
        <Input
          id="adjust-quantity"
          inputMode="decimal"
          autoComplete="off"
          className="amount"
          aria-invalid={Boolean(errors.quantity)}
          aria-describedby={describedBy("adjust-quantity", errors.quantity?.message)}
          {...form.register("quantity")}
        />
      </FormField>
      <FormField id="adjust-date" label={a.date}>
        <Input id="adjust-date" type="date" {...form.register("adjustmentDate")} />
      </FormField>
      <FormField id="adjust-notes" label={a.notes} optional error={errors.notes?.message}>
        <Textarea id="adjust-notes" {...form.register("notes")} />
      </FormField>
      {reason === "damaged" || reason === "lost" ? (
        <p className="text-sm text-muted-foreground">{a.lossNote}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? copy.common.saving : copy.common.save}
      </Button>
    </form>
  );
}
