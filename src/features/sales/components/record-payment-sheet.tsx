"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { MethodChips } from "@/components/money/method-chips";
import { copy } from "@/lib/copy";
import { compareMoney, formatMoney, parseMoneyInput } from "@/lib/money";
import { recordPayment } from "../actions";
import { paymentSchema, type PaymentInput } from "../schema";

const s = copy.sales;

/** "Record payment" with the amount pre-filled with the balance (SPEC Section 9, flow 4). */
export function RecordPaymentSheet({
  open,
  onOpenChange,
  saleId,
  balance,
  saleDate,
  today,
  currencyCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  balance: string;
  saleDate: string;
  today: string;
  currencyCode: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={s.recordPayment}
        description={`${s.balance}: ${formatMoney(balance, currencyCode)}`}
      >
        {open ? (
          <PaymentForm
            saleId={saleId}
            balance={balance}
            defaultDate={today < saleDate ? saleDate : today}
            saleDate={saleDate}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PaymentForm({
  saleId,
  balance,
  defaultDate,
  saleDate,
  onDone,
}: {
  saleId: string;
  balance: string;
  defaultDate: string;
  saleDate: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [id] = useState(() => crypto.randomUUID());
  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      id,
      saleId,
      amount: balance,
      method: "cash",
      paymentDate: defaultDate,
      reference: "",
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    const amount = parseMoneyInput(values.amount);
    if (amount && compareMoney(amount, balance) > 0) {
      form.setError("amount", { message: s.errors.paymentTooLarge });
      return;
    }
    if (values.paymentDate < saleDate) {
      form.setError("paymentDate", { message: s.errors.paymentBeforeSale });
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const result = await recordPayment(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(s.paymentSaved);
      onDone();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}
      <FormField id="payment-amount" label={s.amount} error={errors.amount?.message}>
        <Input
          id="payment-amount"
          inputMode="decimal"
          autoComplete="off"
          className="h-14 text-2xl font-semibold amount"
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={describedBy("payment-amount", errors.amount?.message)}
          {...form.register("amount")}
        />
      </FormField>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{s.howPaid}</p>
        <Controller
          control={form.control}
          name="method"
          render={({ field }) => (
            <MethodChips
              id="payment-method"
              label={s.howPaid}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <FormField id="payment-date" label={s.paymentDate} error={errors.paymentDate?.message}>
        <Input
          id="payment-date"
          type="date"
          min={saleDate}
          aria-invalid={Boolean(errors.paymentDate)}
          aria-describedby={describedBy("payment-date", errors.paymentDate?.message)}
          {...form.register("paymentDate")}
        />
      </FormField>
      <FormField
        id="payment-reference"
        label={s.paymentReference}
        optional
        hint={s.paymentReferenceHint}
      >
        <Input
          id="payment-reference"
          autoComplete="off"
          aria-describedby="payment-reference-hint"
          {...form.register("reference")}
        />
      </FormField>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? copy.common.saving : s.recordPayment}
      </Button>
    </form>
  );
}
