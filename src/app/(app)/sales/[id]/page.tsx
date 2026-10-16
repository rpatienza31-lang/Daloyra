import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { DueStatusText, SaleStatusPill } from "@/components/money/sale-status-pill";
import { PaymentsList } from "@/features/sales/components/payments-list";
import { SaleActions } from "@/features/sales/components/sale-actions";
import { getSale } from "@/features/sales/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { formatDate, todayIn } from "@/lib/dates";
import { compareMoney, formatMoney, formatQuantity } from "@/lib/money";
import { can } from "@/lib/permissions";
import { isUuid } from "@/lib/uuid";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: `${copy.sales.title} · ${copy.brand.name}` };

export default async function SalePage({ params }: PageProps<"/sales/[id]">) {
  const { id } = await params;
  const business = await getCurrentBusiness();
  if (!business || !isUuid(id)) notFound();
  const found = await getSale(business.id, id);
  if (!found) notFound();
  const { sale, items, payments } = found;

  const s = copy.sales;
  const money = (value: string) => formatMoney(value, business.currencyCode);
  const voided = sale.voidedAt !== null;
  const hasBalance = compareMoney(sale.balance, "0") > 0;
  const activePayments = payments.filter((p) => p.voidedAt === null).length;

  return (
    <>
      <Link
        href="/sales"
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {s.back}
      </Link>
      <PageHeader
        title={`${s.singular} ${sale.referenceNo}`}
        description={`${formatDate(sale.saleDate)} · ${sale.customerName ?? s.walkIn}`}
        actions={
          voided ? null : (
            <div className="flex flex-wrap gap-2">
              <SaleActions
                saleId={sale.id}
                referenceNo={sale.referenceNo}
                total={sale.total}
                amountPaid={sale.amountPaid}
                activePayments={activePayments}
                balance={sale.balance}
                saleDate={sale.saleDate}
                today={todayIn(business.timezone)}
                currencyCode={business.currencyCode}
                canRecord={hasBalance && can(business.role, "money.record")}
                canEdit={can(business.role, "money.edit")}
                canVoid={can(business.role, "money.void")}
              />
              <Button asChild variant="outline">
                <Link href={`/receipts/${sale.id}`}>
                  <Printer aria-hidden />
                  {s.printReceipt}
                </Link>
              </Button>
            </div>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SaleStatusPill paymentStatus={sale.paymentStatus} dueStatus={sale.dueStatus} />
        {sale.dueDate && !voided && hasBalance ? (
          <span className="text-sm text-muted-foreground">
            {s.dueDate}: {formatDate(sale.dueDate)} <DueStatusText dueStatus={sale.dueStatus} />
          </span>
        ) : null}
        {voided && sale.voidReason ? (
          <span className="text-sm text-muted-foreground">{s.voidedBy(sale.voidReason)}</span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section
          aria-labelledby="sale-items"
          className="rounded-card border border-border bg-card shadow-soft"
        >
          <h2 id="sale-items" className="sr-only">
            {s.items}
          </h2>
          <ul className="divide-y divide-border">
            {items.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">{item.description}</p>
                  <p className="text-sm text-muted-foreground amount">
                    {formatQuantity(item.quantity)} × {money(item.unitPrice)}
                  </p>
                </div>
                <span className="shrink-0 amount">{money(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl
            className={cn(
              "border-t border-border px-4 py-3 text-sm",
              voided && "text-muted-foreground line-through",
            )}
          >
            {sale.discount !== "0.00" ? (
              <>
                <div className="flex justify-between py-1">
                  <dt className="text-muted-foreground">{s.subtotal}</dt>
                  <dd className="amount">{money(sale.subtotal)}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-muted-foreground">{s.discount}</dt>
                  <dd className="amount">−{money(sale.discount)}</dd>
                </div>
              </>
            ) : null}
            <div className="flex justify-between py-1 text-base font-semibold">
              <dt>{s.total}</dt>
              <dd className="amount">{money(sale.total)}</dd>
            </div>
          </dl>
        </section>

        <aside className="flex flex-col gap-4">
          <dl className="rounded-card border border-border bg-card p-4 shadow-soft">
            <div className="flex justify-between py-1 text-sm">
              <dt className="text-muted-foreground">{s.paid}</dt>
              <dd className="text-money-in amount">{money(sale.amountPaid)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <dt>{s.balance}</dt>
              <dd className="amount">{money(sale.balance)}</dd>
            </div>
          </dl>
          {sale.notes ? (
            <div className="rounded-card border border-border bg-card p-4 text-sm">
              <p className="text-muted-foreground">{s.notes}</p>
              <p className="mt-1 whitespace-pre-line">{sale.notes}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <section aria-labelledby="sale-payments" className="mt-8">
        <h2 id="sale-payments" className="mb-3 text-lg font-semibold">
          {s.payments}
        </h2>
        <PaymentsList
          saleId={sale.id}
          payments={payments}
          currencyCode={business.currencyCode}
          canVoid={!voided && can(business.role, "money.void")}
        />
      </section>
    </>
  );
}
