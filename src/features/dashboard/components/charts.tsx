"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { copy } from "@/lib/copy";
import { formatDate, formatDayShort, formatMonth } from "@/lib/dates";
import { compareMoney, formatMoney } from "@/lib/money";
import type { DayPoint, MonthPoint } from "../queries";

const t = copy.app.dashboard.charts;
const c = copy.app.dashboard.cards;

/*
 * Charts only draw figures that Postgres already computed. Amounts arrive as decimal
 * strings; they are turned into numbers solely to place marks on screen, and every
 * number a person reads (tooltips, tables) is formatted from the original string.
 */
const SERIES = [
  { key: "sales", label: c.sales, color: "var(--chart-sales)" },
  { key: "purchases", label: c.purchases, color: "var(--chart-purchases)" },
  { key: "expenses", label: c.expenses, color: "var(--chart-expenses)" },
] as const;

const AXIS_TICK = { fill: "var(--text-secondary)", fontSize: 12 };
const CHART_HEIGHT = 240;

function compactFormatter(currencyCode: string) {
  const f = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (value: number) => f.format(value);
}

/** A titled card holding one chart, with the same figures available as a table. */
function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle: string;
  legend?: React.ReactNode;
  table: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-soft"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {legend}
      </div>
      {children}
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-primary">
          {t.tableLabel(title)}
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">{table}</div>
      </details>
    </section>
  );
}

function Legend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="min-w-40 rounded-control border border-border bg-popover px-3 py-2 text-sm shadow-soft">
      <p className="mb-1 font-medium">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              {row.color ? (
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: row.color }}
                />
              ) : null}
              {row.label}
            </span>
            <span className="font-medium amount">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTableView({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-left">
      <thead className="text-muted-foreground">
        <tr>
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={i === 0 ? "py-1 pr-3 font-medium" : "py-1 pl-3 text-right font-medium"}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]} className="border-t border-border">
            {r.map((cell, i) => (
              <td key={i} className={i === 0 ? "py-1 pr-3" : "py-1 pl-3 text-right amount"}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** (1) Sales vs Purchases vs Expenses by month, last 12 months. */
export function MonthlyChart({ data, currencyCode }: { data: MonthPoint[]; currencyCode: string }) {
  const money = (v: string) => formatMoney(v, currencyCode);
  const rows = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
    salesValue: Number(d.sales),
    purchasesValue: Number(d.purchases),
    expensesValue: Number(d.expenses),
  }));
  return (
    <ChartCard
      title={t.monthlyTitle}
      subtitle={t.monthlySubtitle}
      legend={<Legend items={SERIES} />}
      table={
        <DataTableView
          head={[t.month, c.sales, c.purchases, c.expenses]}
          rows={data.map((d) => [
            formatMonth(d.month, true),
            money(d.sales),
            money(d.purchases),
            money(d.expenses),
          ])}
        />
      }
    >
      <div aria-hidden style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            barGap={2}
            barCategoryGap="20%"
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border-hairline)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              width={64}
              tickFormatter={compactFormatter(currencyCode)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !row) return null;
                return (
                  <TooltipBox
                    title={formatMonth(row.month, true)}
                    rows={SERIES.map((s) => ({
                      label: s.label,
                      value: money(row[s.key]),
                      color: s.color,
                    }))}
                  />
                );
              }}
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={`${s.key}Value`}
                name={s.label}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={14}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** (2) Profit by month: green above zero, red below, with the sign in every label. */
export function ProfitChart({ data, currencyCode }: { data: MonthPoint[]; currencyCode: string }) {
  const money = (v: string) => formatMoney(v, currencyCode);
  const rows = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
    value: Number(d.profit),
    negative: compareMoney(d.profit, "0") < 0,
  }));
  return (
    <ChartCard
      title={t.profitTitle}
      subtitle={t.profitSubtitle}
      table={
        <DataTableView
          head={[t.month, c.profit]}
          rows={data.map((d) => [formatMonth(d.month, true), money(d.profit)])}
        />
      }
    >
      <div aria-hidden style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            barCategoryGap="25%"
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border-hairline)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              width={64}
              tickFormatter={compactFormatter(currencyCode)}
            />
            <ReferenceLine y={0} stroke="var(--text-muted)" />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !row) return null;
                return (
                  <TooltipBox
                    title={formatMonth(row.month, true)}
                    rows={[
                      {
                        label: row.negative
                          ? `${c.profit} (${copy.app.dashboard.profitLoss})`
                          : c.profit,
                        value: money(row.profit),
                        color: row.negative ? "var(--money-out)" : "var(--money-in)",
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="value"
              name={c.profit}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell key={r.month} fill={r.negative ? "var(--money-out)" : "var(--money-in)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** (3) Sales per day for the selected period. */
export function DailyChart({
  data,
  currencyCode,
  tooLong,
}: {
  data: DayPoint[];
  currencyCode: string;
  tooLong: boolean;
}) {
  const money = (v: string) => formatMoney(v, currencyCode);
  const rows = data.map((d) => ({ ...d, label: formatDayShort(d.day), value: Number(d.sales) }));
  const empty = data.every((d) => compareMoney(d.sales, "0") === 0);
  return (
    <ChartCard
      title={t.dailyTitle}
      subtitle={t.dailySubtitle}
      table={
        <DataTableView
          head={[t.day, c.sales]}
          rows={data.map((d) => [formatDate(d.day), money(d.sales)])}
        />
      }
    >
      {tooLong || empty ? (
        <p
          className="flex items-center justify-center rounded-control bg-muted/50 px-4 text-center text-sm text-muted-foreground"
          style={{ height: CHART_HEIGHT }}
        >
          {tooLong ? t.dailyTooLong : t.noData}
        </p>
      ) : (
        <div aria-hidden style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-hairline)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                width={64}
                tickFormatter={compactFormatter(currencyCode)}
              />
              <Tooltip
                cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !row) return null;
                  return (
                    <TooltipBox
                      title={formatDate(row.day)}
                      rows={[
                        { label: c.sales, value: money(row.sales), color: "var(--chart-sales)" },
                      ]}
                    />
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={c.sales}
                stroke="var(--chart-sales)"
                strokeWidth={2}
                fill="var(--chart-sales)"
                fillOpacity={0.12}
                dot={rows.length <= 1 ? { r: 4, fill: "var(--chart-sales)" } : false}
                activeDot={{ r: 5, stroke: "var(--surface-card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
