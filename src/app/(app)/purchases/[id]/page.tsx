import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DueStatusText, SaleStatusPill } from "@/components/money/sale-status-pill";
import { PaymentsList } from "@/features/purchases/components/payments-list";
import { PurchaseActions } from "@/features/purchases/components/purchase-actions";
import { getPurchase } from "@/features/purchases/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { formatDate, todayIn } from "@/lib/dates";
import { compareMoney, formatMoney, formatQuantity } from "@/lib/money";
import { can } from "@/lib/permissions";
import { isUuid } from "@/lib/uuid";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: `${copy.purchases.title} · ${copy.brand.name}` };

export default async function PurchasePage({ params }: PageProps<"/purchases/[id]">) {
  const { id } = await params;
  const business = await getCurrentBusiness();
  if (!business || !isUuid(id)) notFound();
  const found = await getPurchase(business.id, id);
  if (!found) notFound();
  const { purchase, items, payments } = found;

  const s = copy.purchases;
  const money = (value: string) => formatMoney(value, business.currencyCode);
  const voided = purchase.voidedAt !== null;
  const hasBalance = compareMoney(purchase.balance, "0") > 0;
  const activePayments = payments.filter((p) => p.voidedAt === null).length;

  return (
    <>
      <Link
        href="/purchases"
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {s.back}
      </Link>
      <PageHeader
        title={`${s.singular} ${purchase.referenceNo}`}
        description={`${formatDate(purchase.purchaseDate)} · ${purchase.supplierName ?? s.noSupplier}`}
        actions={
          voided ? null : (
            <div className="flex flex-wrap gap-2">
              <PurchaseActions
                purchaseId={purchase.id}
                referenceNo={purchase.referenceNo}
                total={purchase.total}
                amountPaid={purchase.amountPaid}
                activePayments={activePayments}
                balance={purchase.balance}
                purchaseDate={purchase.purchaseDate}
                today={todayIn(business.timezone)}
                currencyCode={business.currencyCode}
                canRecord={hasBalance && can(business.role, "money.record")}
                canEdit={can(business.role, "money.edit")}
                canVoid={can(business.role, "money.void")}
              />
            </div>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SaleStatusPill paymentStatus={purchase.paymentStatus} dueStatus={purchase.dueStatus} />
        {purchase.dueDate && !voided && hasBalance ? (
          <span className="text-sm text-muted-foreground">
            {s.dueDate}: {formatDate(purchase.dueDate)}{" "}
            <DueStatusText dueStatus={purchase.dueStatus} />
          </span>
        ) : null}
        {voided && purchase.voidReason ? (
          <span className="text-sm text-muted-foreground">{s.voidedBy(purchase.voidReason)}</span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section
          aria-labelledby="purchase-items"
          className="rounded-card border border-border bg-card shadow-soft"
        >
          <h2 id="purchase-items" className="sr-only">
            {s.items}
          </h2>
          <ul className="divide-y divide-border">
            {items.map((item, index) => (
              <li key={index} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">{item.description}</p>
                  <p className="text-sm text-muted-foreground amount">
                    {formatQuantity(item.quantity)} × {money(item.unitCost)}
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
            {purchase.discount !== "0.00" ? (
              <>
                <div className="flex justify-between py-1">
                  <dt className="text-muted-foreground">{s.subtotal}</dt>
                  <dd className="amount">{money(purchase.subtotal)}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-muted-foreground">{s.discount}</dt>
                  <dd className="amount">−{money(purchase.discount)}</dd>
                </div>
              </>
            ) : null}
            <div className="flex justify-between py-1 text-base font-semibold">
              <dt>{s.total}</dt>
              <dd className="amount">{money(purchase.total)}</dd>
            </div>
          </dl>
        </section>

        <aside className="flex flex-col gap-4">
          <dl className="rounded-card border border-border bg-card p-4 shadow-soft">
            <div className="flex justify-between py-1 text-sm">
              <dt className="text-muted-foreground">{s.paid}</dt>
              <dd className="text-money-in amount">{money(purchase.amountPaid)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <dt>{s.balance}</dt>
              <dd className="amount">{money(purchase.balance)}</dd>
            </div>
          </dl>
          {purchase.notes ? (
            <div className="rounded-card border border-border bg-card p-4 text-sm">
              <p className="text-muted-foreground">{s.notes}</p>
              <p className="mt-1 whitespace-pre-line">{purchase.notes}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <section aria-labelledby="purchase-payments" className="mt-8">
        <h2 id="purchase-payments" className="mb-3 text-lg font-semibold">
          {s.payments}
        </h2>
        <PaymentsList
          purchaseId={purchase.id}
          payments={payments}
          currencyCode={business.currencyCode}
          canVoid={!voided && can(business.role, "money.void")}
        />
      </section>
    </>
  );
}
