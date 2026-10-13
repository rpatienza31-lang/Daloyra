import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/dates";
import { PAYMENT_METHOD_VALUES, type PaymentMethod } from "@/lib/payment-methods";

/** Every dashboard figure (SPEC 3.4 and 3.5), as decimal strings computed in Postgres. */
export interface DashboardFigures {
  today: string;
  sales: string;
  purchases: string;
  expenses: string;
  profit: string;
  moneyIn: string;
  moneyOut: string;
  netCashFlow: string;
  salesToday: string;
  cashBalance: string;
  amountToCollect: string;
  amountToPay: string;
}

export interface MonthPoint {
  month: string;
  sales: string;
  purchases: string;
  expenses: string;
  profit: string;
}

export interface DayPoint {
  day: string;
  sales: string;
}

export interface MethodTotal {
  method: PaymentMethod;
  moneyIn: string;
  moneyOut: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "0.00";
}

export async function getDashboard(
  businessId: string,
  range: DateRange,
): Promise<DashboardFigures> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard", {
    p_business_id: businessId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error("Could not load the dashboard.", { cause: error });
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    today: text(d.today),
    sales: text(d.sales),
    purchases: text(d.purchases),
    expenses: text(d.expenses),
    profit: text(d.profit),
    moneyIn: text(d.money_in),
    moneyOut: text(d.money_out),
    netCashFlow: text(d.net_cash_flow),
    salesToday: text(d.sales_today),
    cashBalance: text(d.cash_balance),
    amountToCollect: text(d.amount_to_collect),
    amountToPay: text(d.amount_to_pay),
  };
}

/** Twelve months ending with the month of `end`. */
export async function getMonthlySeries(businessId: string, end: string): Promise<MonthPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_monthly_series", {
    p_business_id: businessId,
    p_months: 12,
    p_end: end,
  });
  if (error) throw new Error("Could not load the monthly figures.", { cause: error });
  return (data ?? []).map((r) => ({
    month: r.month,
    sales: r.sales,
    purchases: r.purchases,
    expenses: r.expenses,
    profit: r.profit,
  }));
}

export async function getDailySeries(businessId: string, range: DateRange): Promise<DayPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_series", {
    p_business_id: businessId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error("Could not load the daily sales.", { cause: error });
  return (data ?? []).map((r) => ({ day: r.day, sales: r.sales }));
}

export async function getMoneyByMethod(
  businessId: string,
  range: DateRange,
): Promise<MethodTotal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_money_by_method", {
    p_business_id: businessId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error("Could not load the payment methods.", { cause: error });
  return (data ?? []).flatMap((r) => {
    const method = PAYMENT_METHOD_VALUES.find((m) => m === r.method);
    return method ? [{ method, moneyIn: r.money_in, moneyOut: r.money_out }] : [];
  });
}
