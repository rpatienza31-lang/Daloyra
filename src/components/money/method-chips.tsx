"use client";

import { useState } from "react";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const PRIMARY: PaymentMethod[] = ["cash", "gcash", "maya", "bank_transfer", "card"];

/** One-tap payment method choice: the common five, plus More (SPEC Section 9, flow 3). */
export function MethodChips({
  value,
  onChange,
  label,
  id,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  label: string;
  id: string;
}) {
  const [showMore, setShowMore] = useState(!PRIMARY.includes(value));
  const visible = PAYMENT_METHODS.filter((m) => showMore || PRIMARY.includes(m.value));

  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      {visible.map((m) => {
        const Icon = m.icon;
        const selected = m.value === value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(m.value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {m.label}
          </button>
        );
      })}
      {showMore ? null : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="inline-flex min-h-11 items-center rounded-full border border-dashed border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {copy.sales.moreMethods}
        </button>
      )}
    </div>
  );
}
