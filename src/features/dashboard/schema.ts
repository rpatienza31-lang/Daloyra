import { z } from "zod";
import { periodRange, type DateRange, type PeriodKey } from "@/lib/dates";

export const PERIODS = ["today", "this_week", "this_month", "this_year", "custom"] as const;
export type Period = (typeof PERIODS)[number];

export interface SelectedPeriod extends DateRange {
  period: Period;
  /** Set when a custom range was asked for but was not valid; the default is used instead. */
  invalid: boolean;
}

const customRange = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((r) => r.from <= r.to);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The dashboard period from the URL (`?period=this_week` or `?period=custom&from=…&to=…`).
 * Ranges are computed for today in the business timezone. Defaults to This month (SPEC 10).
 */
export function selectPeriod(
  params: Record<string, string | string[] | undefined>,
  timezone: string,
  now: Date = new Date(),
): SelectedPeriod {
  const period = PERIODS.find((p) => p === first(params.period)) ?? "this_month";
  if (period === "custom") {
    const parsed = customRange.safeParse({ from: first(params.from), to: first(params.to) });
    if (parsed.success) return { period, ...parsed.data, invalid: false };
    return { period: "this_month", ...periodRange("this_month", timezone, now), invalid: true };
  }
  return { period, ...periodRange(period satisfies PeriodKey, timezone, now), invalid: false };
}

/** Days in an inclusive range of ISO dates. */
export function daysInRange(range: DateRange): number {
  const ms = Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** The daily sales chart covers at most this many days (the database limit is 367). */
export const MAX_DAILY_DAYS = 366;
