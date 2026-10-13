"use client";

import { useState } from "react";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

const t = copy.app.dashboard.methods;

export interface MethodShare {
  method: PaymentMethod;
  amount: string;
  /** Share of the total, already formatted ("42%", "<1%"). */
  share: string;
}

/**
 * "How money came in" (SPEC 3.7 and 10): Money In per payment method for the period,
 * with a toggle to Money Out. Figures and shares come from the server.
 */
export function MethodPanel({
  moneyIn,
  moneyOut,
  totalIn,
  totalOut,
  currencyCode,
}: {
  moneyIn: MethodShare[];
  moneyOut: MethodShare[];
  totalIn: string;
  totalOut: string;
  currencyCode: string;
}) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const rows = direction === "in" ? moneyIn : moneyOut;
  const total = direction === "in" ? totalIn : totalOut;

  return (
    <section
      aria-labelledby="methods-title"
      className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-soft"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="methods-title" className="text-base font-semibold">
            {direction === "in" ? t.title : t.titleOut}
          </h2>
          <p className="text-sm text-muted-foreground">
            {direction === "in" ? t.in : t.out}:{" "}
            <span className="font-medium text-foreground amount">
              {formatMoney(total, currencyCode)}
            </span>
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label={t.toggle}
          className="inline-flex gap-0.5 self-start rounded-full bg-muted p-1 ring-1 ring-border/60 ring-inset"
        >
          {(["in", "out"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => setDirection(d)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-9",
                direction === d
                  ? "bg-card font-semibold text-primary shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d === "in" ? t.in : t.out}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-control bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
          {t.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const m = PAYMENT_METHODS.find((x) => x.value === row.method) ?? PAYMENT_METHODS[0];
            const Icon = m.icon;
            const width = row.share === "<1%" ? 1 : Number.parseInt(row.share, 10);
            return (
              <li key={row.method} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2 font-medium">
                    <Icon aria-hidden className="size-4 shrink-0" style={{ color: m.color }} />
                    <span className="truncate">{m.label}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="font-semibold amount">
                      {formatMoney(row.amount, currencyCode)}
                    </span>
                    <span className="ml-2 inline-block w-11 text-muted-foreground amount">
                      {row.share}
                    </span>
                  </span>
                </div>
                <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      direction === "in" ? "bg-money-in" : "bg-money-out",
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
