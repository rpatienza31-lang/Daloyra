"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, ShoppingCart } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select-native";
import { copy } from "@/lib/copy";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import type { PurchaseFilter, PurchaseSummary } from "../queries";
import { PurchaseCard, purchaseColumns } from "./purchase-columns";

const s = copy.purchases;
const FILTERS: { key: PurchaseFilter; label: string }[] = [
  { key: "all", label: s.filters.all },
  { key: "to_pay", label: s.filters.toPay },
  { key: "paid", label: s.filters.paid },
  { key: "voided", label: s.filters.voided },
];

export function PurchasesList({
  purchases,
  filter,
  method,
  currencyCode,
  hasAnyPurchases,
}: {
  purchases: PurchaseSummary[];
  filter: PurchaseFilter;
  method: string;
  currencyCode: string;
  hasAnyPurchases: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const columns = useMemo(() => purchaseColumns(currencyCode, "purchases"), [currencyCode]);

  function hrefWith(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const newButton = (
    <Button asChild>
      <Link href="/purchases/new">
        <Plus aria-hidden />
        {s.add}
      </Link>
    </Button>
  );

  if (!hasAnyPurchases) {
    return (
      <>
        <PageHeader title={s.title} />
        <EmptyState
          icon={ShoppingCart}
          title={s.emptyTitle}
          body={s.emptyBody}
          action={newButton}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title={s.title} actions={newButton} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label={s.title} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex gap-0.5 rounded-full bg-muted p-1 ring-1 ring-border/60 ring-inset">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={hrefWith("status", f.key)}
                aria-current={filter === f.key ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap",
                  filter === f.key
                    ? "bg-card font-semibold text-primary shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="sm:w-52">
          <label htmlFor="method-filter" className="sr-only">
            {s.methodFilter}
          </label>
          <NativeSelect
            id="method-filter"
            value={method}
            onChange={(event) => router.push(hrefWith("method", event.target.value))}
          >
            <option value="">{s.anyMethod}</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {purchases.length === 0 ? (
        <p className="rounded-card border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {s.emptyFiltered}
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={purchases}
          getRowId={(x) => x.id}
          searchPlaceholder={s.searchPlaceholder}
          rowHref={(x) => `/purchases/${x.id}`}
          renderCard={(x) => <PurchaseCard purchase={x} currencyCode={currencyCode} />}
        />
      )}
    </>
  );
}
