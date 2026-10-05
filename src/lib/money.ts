import Decimal from "decimal.js";

/**
 * Money helpers (SPEC Section 3.1).
 * Amounts cross the app boundary as strings (Postgres numeric(14,2) → string).
 * decimal.js is for live form previews only; saved totals come from Postgres.
 * Never do arithmetic on JS `number` for money.
 */

const MoneyDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** Largest value that fits numeric(14,2). */
export const MAX_AMOUNT = "999999999999.99";

/** Round half-up to 2 decimals and return a canonical string, e.g. "1234.50". */
export function roundMoney(value: Decimal.Value): string {
  return new MoneyDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** round(quantity × unit_price, 2) — mirrors the generated column in the database. */
export function lineTotal(quantity: Decimal.Value, unitPrice: Decimal.Value): string {
  return roundMoney(new MoneyDecimal(quantity).times(unitPrice));
}

/** Sum amounts exactly. */
export function sumMoney(values: readonly Decimal.Value[]): string {
  return roundMoney(values.reduce<Decimal>((acc, v) => acc.plus(v), new MoneyDecimal(0)));
}

/**
 * Parse what a user typed into a canonical amount string, or null if invalid.
 * Accepts "1,234.5", "₱ 1234", "  12 ". Rejects negatives, more than 2 decimals,
 * and values beyond numeric(14,2).
 */
export function parseMoneyInput(raw: string): string | null {
  const cleaned = raw.replace(/[₱$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = new MoneyDecimal(cleaned);
  if (value.greaterThan(MAX_AMOUNT)) return null;
  return value.toFixed(2);
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Display an amount with the business currency, e.g. "₱1,234.50". */
export function formatMoney(amount: Decimal.Value, currencyCode = "PHP", locale = "en-PH"): string {
  const key = `${locale}|${currencyCode}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, formatter);
  }
  // Intl formats decimal strings exactly, with no float conversion.
  return formatter.format(roundMoney(amount) as `${number}`);
}
