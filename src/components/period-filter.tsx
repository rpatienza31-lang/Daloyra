"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const t = copy.app.dashboard;

export type PeriodOption = keyof typeof t.periods;

/**
 * Today · This week · This month · This year · Custom (SPEC 3.8), used by the dashboard and
 * the reports. The URL holds the choice; the default period has no query string.
 */
export function PeriodFilter({
  basePath,
  periods,
  defaultPeriod,
  period,
  from,
  to,
  invalid,
}: {
  basePath: string;
  periods: readonly PeriodOption[];
  defaultPeriod: PeriodOption;
  period: PeriodOption;
  from: string;
  to: string;
  invalid: boolean;
}) {
  const router = useRouter();
  const [custom, setCustom] = useState(period === "custom" || invalid);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [error, setError] = useState<string | null>(invalid ? t.invalidRange : null);

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label={t.period} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex rounded-control border border-border bg-card p-1">
          {periods.map((p) => {
            const current = custom ? p === "custom" : p === period;
            const className = cn(
              "inline-flex min-h-11 items-center rounded-[8px] px-3 text-sm font-medium whitespace-nowrap focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-9",
              current
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            );
            return p === "custom" ? (
              <button
                key={p}
                type="button"
                aria-pressed={current}
                className={className}
                onClick={() => setCustom(true)}
              >
                {t.periods[p]}
              </button>
            ) : (
              <Link
                key={p}
                href={p === defaultPeriod ? basePath : `${basePath}?period=${p}`}
                aria-current={current ? "page" : undefined}
                className={className}
                onClick={() => {
                  setCustom(false);
                  setError(null);
                }}
              >
                {t.periods[p]}
              </Link>
            );
          })}
        </div>
      </nav>
      {custom ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!customFrom || !customTo || customFrom > customTo) {
              setError(t.invalidRange);
              return;
            }
            setError(null);
            router.push(`${basePath}?period=custom&from=${customFrom}&to=${customTo}`);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-from">{t.from}</Label>
            <Input
              id="period-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-to">{t.to}</Label>
            <Input
              id="period-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
          <Button type="submit">{t.apply}</Button>
        </form>
      ) : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
