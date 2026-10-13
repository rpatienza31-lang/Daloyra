import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getUserId } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { formatMoney, sharePercent } from "@/lib/money";
import type { CurrentBusiness } from "@/features/business/queries";
import { listOverdue } from "@/features/sales/queries";
import { listTransactions } from "@/features/transactions/queries";
import { transactionHref } from "@/features/transactions/schema";
import { TransactionCard } from "@/features/transactions/components/transaction-parts";
import { getDailySeries, getDashboard, getMoneyByMethod, getMonthlySeries } from "../queries";
import { MAX_DAILY_DAYS, PERIODS, daysInRange, type SelectedPeriod } from "../schema";
import { DailyChart, MonthlyChart, ProfitChart } from "./charts";
import { MethodPanel, type MethodShare } from "./method-panel";
import { PeriodFilter } from "@/components/period-filter";
import { StatCard } from "@/components/money/stat-card";

const t = copy.app.dashboard;

function periodLabel(selected: SelectedPeriod): string {
  if (selected.period === "custom")
    return selected.from === selected.to
      ? formatDate(selected.from)
      : `${formatDate(selected.from)} – ${formatDate(selected.to)}`;
  return t.periods[selected.period].toLowerCase();
}

/** The full dashboard (SPEC Section 10, "Dashboard layout"). Every figure comes from Postgres. */
export async function DashboardView({
  business,
  selected,
}: {
  business: CurrentBusiness;
  selected: SelectedPeriod;
}) {
  const tooLong = daysInRange(selected) > MAX_DAILY_DAYS;
  const [figures, monthly, daily, methods, recent, overdue] = await Promise.all([
    getDashboard(business.id, selected),
    getMonthlySeries(business.id, selected.to),
    tooLong ? Promise.resolve([]) : getDailySeries(business.id, selected),
    getMoneyByMethod(business.id, selected),
    listTransactions(business.id, {}, { limit: 8 }),
    listOverdue(business.id, 5),
  ]);
  const currency = business.currencyCode;
  const c = t.cards;

  const shares = (direction: "in" | "out"): MethodShare[] => {
    const total = direction === "in" ? figures.moneyIn : figures.moneyOut;
    return methods
      .map((m) => ({ method: m.method, amount: direction === "in" ? m.moneyIn : m.moneyOut }))
      .filter((m) => m.amount !== "0.00")
      .map((m) => ({ ...m, share: sharePercent(m.amount, total) }));
  };

  return (
    <>
      <PageHeader title={t.title} description={business.name} />
      <div className="flex flex-col gap-8">
        <section aria-labelledby="now-title" className="flex flex-col gap-3">
          <h2
            id="now-title"
            className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
          >
            {t.rightNow}
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={c.salesToday}
              amount={figures.salesToday}
              currencyCode={currency}
              accent="sales"
              testId="sales-today"
            />
            <StatCard
              label={c.cashBalance}
              amount={figures.cashBalance}
              currencyCode={currency}
              info={t.info.cashBalance}
              signed
              accent="cash"
              testId="cash-balance"
            />
            <StatCard
              label={c.amountToCollect}
              amount={figures.amountToCollect}
              currencyCode={currency}
              info={t.info.amountToCollect}
              accent="collect"
              testId="amount-to-collect"
            />
            <StatCard
              label={c.amountToPay}
              amount={figures.amountToPay}
              currencyCode={currency}
              info={t.info.amountToPay}
              accent="purchases"
              testId="amount-to-pay"
            />
          </div>
        </section>

        <section aria-labelledby="period-title" className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <h2
              id="period-title"
              className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              {t.forPeriod(periodLabel(selected))}
            </h2>
            <PeriodFilter
              basePath="/dashboard"
              periods={PERIODS}
              defaultPeriod="this_month"
              key={`${selected.period}|${selected.from}|${selected.to}`}
              period={selected.period}
              from={selected.from}
              to={selected.to}
              invalid={selected.invalid}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={c.sales}
              amount={figures.sales}
              currencyCode={currency}
              accent="sales"
              testId="period-sales"
            />
            <StatCard
              label={c.purchases}
              amount={figures.purchases}
              currencyCode={currency}
              accent="purchases"
              testId="period-purchases"
            />
            <StatCard
              label={c.expenses}
              amount={figures.expenses}
              currencyCode={currency}
              accent="expenses"
              testId="period-expenses"
            />
            <StatCard
              label={c.profit}
              amount={figures.profit}
              currencyCode={currency}
              info={t.info.profit}
              accent="profit"
              signed
              highlight
              testId="period-profit"
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MonthlyChart data={monthly} currencyCode={currency} />
          <ProfitChart data={monthly} currencyCode={currency} />
          <DailyChart data={daily} currencyCode={currency} tooLong={tooLong} />
          <MethodPanel
            moneyIn={shares("in")}
            moneyOut={shares("out")}
            totalIn={figures.moneyIn}
            totalOut={figures.moneyOut}
            currencyCode={currency}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section aria-labelledby="recent-title" className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-title" className="text-lg font-semibold">
                {t.recent.title}
              </h2>
              <Button asChild variant="ghost" className="text-primary">
                <Link href="/transactions">
                  {t.recent.viewAll}
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            </div>
            {recent.length === 0 ? (
              <p className="rounded-card border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                {t.recent.empty}
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-soft">
                {recent.map((tx) => (
                  <li key={`${tx.type}-${tx.id}`}>
                    <Link
                      href={transactionHref(tx)}
                      className="block min-h-11 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <TransactionCard tx={tx} currencyCode={currency} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="overdue-title" className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="overdue-title" className="text-lg font-semibold">
                {t.overdue.title}
              </h2>
              <Button asChild variant="ghost" className="text-primary">
                <Link href="/receivables">
                  {t.overdue.viewAll}
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            </div>
            {overdue.length === 0 ? (
              <p className="rounded-card border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                {t.overdue.empty}
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-soft">
                {overdue.map((sale) => (
                  <li key={sale.id}>
                    <Link
                      href={`/sales/${sale.id}`}
                      className="flex min-h-11 items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {sale.customerName ?? copy.transactions.walkIn}
                        </p>
                        <p className="text-sm text-money-out">
                          {sale.referenceNo} ·{" "}
                          {t.overdue.due(formatDate(sale.dueDate ?? sale.saleDate))}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold amount">
                        {formatMoney(sale.balance, currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/** Staff see no totals (SPEC 8): only their own latest entries. */
export async function StaffDashboard({ business }: { business: CurrentBusiness }) {
  const userId = await getUserId();
  const recent = userId
    ? await listTransactions(business.id, {}, { limit: 8, createdBy: userId })
    : [];
  return (
    <>
      <PageHeader title={t.title} description={t.staffBody} />
      <section aria-labelledby="recent-title" className="flex flex-col gap-3">
        <h2 id="recent-title" className="text-lg font-semibold">
          {t.recent.title}
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {t.recent.empty}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-soft">
            {recent.map((tx) => (
              <li key={`${tx.type}-${tx.id}`}>
                <Link
                  href={transactionHref(tx)}
                  className="block min-h-11 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <TransactionCard tx={tx} currencyCode={business.currencyCode} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
