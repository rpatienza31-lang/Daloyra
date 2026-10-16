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

/** Largest quantity that fits numeric(12,3). */
export const MAX_QUANTITY = "999999999.999";

/**
 * Parse a typed quantity into a canonical string with up to 3 decimals, or null.
 * Must be greater than 0. Accepts "2", "1.5", "1,000".
 */
export function parseQuantityInput(raw: string): string | null {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{0,3})?$/.test(cleaned)) return null;
  const value = new MoneyDecimal(cleaned);
  if (value.lessThanOrEqualTo(0) || value.greaterThan(MAX_QUANTITY)) return null;
  return value.toString();
}

/** a − b, exactly, rounded to 2 decimals. For live previews only. */
export function subtractMoney(a: Decimal.Value, b: Decimal.Value): string {
  return roundMoney(new MoneyDecimal(a).minus(b));
}

/** Compare two amounts: -1, 0 or 1. */
export function compareMoney(a: Decimal.Value, b: Decimal.Value): -1 | 0 | 1 {
  return new MoneyDecimal(a).comparedTo(b) as -1 | 0 | 1;
}

/** A quantity for display: "1.5", "12", "1.333". */
export function formatQuantity(quantity: Decimal.Value): string {
  return new MoneyDecimal(quantity).toDecimalPlaces(3).toString();
}

/**
 * part / whole as a display percentage, e.g. "42%" or "<1%". For labels only; never saved.
 * Returns "0%" when the whole is 0.
 */
export function sharePercent(part: Decimal.Value, whole: Decimal.Value): string {
  const w = new MoneyDecimal(whole);
  if (w.lessThanOrEqualTo(0)) return "0%";
  const pct = new MoneyDecimal(part).div(w).times(100);
  if (pct.greaterThan(0) && pct.lessThan(1)) return "<1%";
  return `${pct.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0)}%`;
}

/**
 * Amounts a customer is likely to hand over for a cash payment: the exact amount, then the
 * next round notes (₱20, ₱50, ₱100, ₱500, ₱1,000). At most four. For buttons only.
 */
export function cashSuggestions(paying: Decimal.Value): string[] {
  const amount = new MoneyDecimal(paying);
  const out = [amount.toFixed(2)];
  for (const note of [20, 50, 100, 500, 1000]) {
    const up = amount.div(note).ceil().times(note);
    if (up.greaterThan(amount)) out.push(up.toFixed(2));
  }
  return [...new Set(out)].slice(0, 4);
}

/** a + b for quantities in a live cart preview (up to 3 decimals). Never saved. */
export function addQuantity(a: Decimal.Value, b: Decimal.Value): string {
  return new MoneyDecimal(a).plus(b).toDecimalPlaces(3).toString();
}
