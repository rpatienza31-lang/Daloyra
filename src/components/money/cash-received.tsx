"use client";

import { Input } from "@/components/ui/input";
import { FormField, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import {
  cashSuggestions,
  compareMoney,
  formatMoney,
  parseMoneyInput,
  subtractMoney,
} from "@/lib/money";
import { cn } from "@/lib/utils";

const s = copy.sales;

/**
 * "Cash received" with quick amounts and the change, for cash payments (Phase 10).
 * The change shown here is a preview; the database computes and saves the real one.
 */
export function CashReceived({
  id,
  value,
  onChange,
  paying,
  currencyCode,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** What is being paid now, or null while the amount is not valid yet. */
  paying: string | null;
  currencyCode: string;
  error?: string;
}) {
  const received = parseMoneyInput(value);
  const change =
    received && paying && compareMoney(received, paying) >= 0
      ? subtractMoney(received, paying)
      : null;
  const money = (v: string) => formatMoney(v, currencyCode);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <FormField id={id} label={s.cashReceived} optional hint={s.cashReceivedHint} error={error}>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          className="h-12 text-lg font-semibold amount"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error, s.cashReceivedHint)}
        />
      </FormField>
      {paying && compareMoney(paying, "0") > 0 ? (
        <div className="flex flex-wrap gap-2">
          {cashSuggestions(paying).map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onChange(amount)}
              className={cn(
                "min-h-11 rounded-full border border-border px-4 text-sm font-medium amount hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                received === amount && "border-primary bg-primary/10 text-primary",
              )}
            >
              {money(amount)}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="flex items-baseline justify-between border-t border-border pt-3"
        aria-live="polite"
      >
        <span className="text-sm font-medium text-muted-foreground">{s.change}</span>
        <span
          data-testid="change"
          className={cn(
            "text-2xl font-bold amount",
            change ? "text-money-in" : "text-muted-foreground",
          )}
        >
          {change ? money(change) : "—"}
        </span>
      </div>
    </div>
  );
}
