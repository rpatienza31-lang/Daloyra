import { TZDate } from "@date-fns/tz";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

/**
 * Date helpers (SPEC Section 3.8).
 * Transaction dates are calendar dates ("YYYY-MM-DD") in the business timezone.
 * "Today" is always computed for the business timezone, never the server's.
 */

export const DEFAULT_TIMEZONE = "Asia/Manila";

/** ISO calendar date string, e.g. "2026-10-05". */
export type IsoDate = string;

export type PeriodKey = "today" | "this_week" | "this_month" | "this_year";

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

const WEEK_STARTS_ON = 1; // Monday

/** Today's calendar date in the given timezone. */
export function todayIn(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): IsoDate {
  return format(new TZDate(now, timezone), "yyyy-MM-dd");
}

/** Inclusive date range for a named period, relative to today in the timezone. */
export function periodRange(
  period: PeriodKey,
  timezone: string = DEFAULT_TIMEZONE,
  now: Date = new Date(),
): DateRange {
  const today = parseISO(todayIn(timezone, now));
  const toIso = (d: Date) => format(d, "yyyy-MM-dd");
  switch (period) {
    case "today":
      return { from: toIso(today), to: toIso(today) };
    case "this_week":
      return {
        from: toIso(startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON })),
        to: toIso(endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON })),
      };
    case "this_month":
      return { from: toIso(startOfMonth(today)), to: toIso(endOfMonth(today)) };
    case "this_year":
      return { from: toIso(startOfYear(today)), to: toIso(endOfYear(today)) };
  }
}

/** Add whole days to a calendar date. */
export function addDaysIso(date: IsoDate, days: number): IsoDate {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}
