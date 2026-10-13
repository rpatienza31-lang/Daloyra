"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, X } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import type { PartyOption, Transaction } from "../queries";
import {
  STATUS_FILTERS,
  TRANSACTION_TYPES,
  transactionHref,
  type TransactionFilters,
} from "../schema";
import {
  TransactionAmount,
  TransactionCard,
  TransactionStatus,
  transactionDetails,
  transactionTitle,
} from "./transaction-parts";

const t = copy.transactions;

/** /transactions: the unified history (SPEC Section 10). Filters live in the URL. */
export function TransactionsList({
  transactions,
  filters,
  parties,
  currencyCode,
  hasAny,
  capped,
}: {
  transactions: Transaction[];
  filters: TransactionFilters;
  parties: PartyOption[];
  currencyCode: string;
  hasAny: boolean;
  capped: number | null;
}) {
  const router = useRouter();
  const filtered = Object.values(filters).some(Boolean);

  const columns = useMemo<DataTableColumn<Transaction>[]>(
    () => [
      {
        accessorKey: "date",
        header: t.date,
        cell: ({ row }) => formatDate(row.original.date),
      },
      { id: "type", accessorFn: (x) => t.types[x.type], header: t.type },
      { id: "party", accessorFn: transactionTitle, header: t.party },
      {
        id: "details",
        accessorFn: transactionDetails,
        header: t.details,
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="line-clamp-1 text-muted-foreground">{String(getValue() ?? "")}</span>
        ),
      },
      {
        id: "status",
        header: t.status,
        enableSorting: false,
        cell: ({ row }) => <TransactionStatus tx={row.original} />,
      },
      {
        id: "amount",
        accessorFn: (x) => x.amount,
        header: t.amount,
        sortingFn: "alphanumeric",
        cell: ({ row }) => <TransactionAmount tx={row.original} currencyCode={currencyCode} />,
      },
    ],
    [currencyCode],
  );

  if (!hasAny) {
    return (
      <>
        <PageHeader title={t.title} />
        <EmptyState icon={History} title={t.emptyTitle} body={t.emptyBody} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} />
      <form
        key={JSON.stringify(filters)}
        aria-label={t.filters}
        className="mb-4 grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          for (const [key, value] of data) {
            if (typeof value === "string" && value) next.set(key, value);
          }
          const qs = next.toString();
          router.push(qs ? `/transactions?${qs}` : "/transactions");
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-type">{t.type}</Label>
          <NativeSelect id="filter-type" name="type" defaultValue={filters.type ?? ""}>
            <option value="">{t.anyType}</option>
            {TRANSACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {t.types[type]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-method">{t.method}</Label>
          <NativeSelect id="filter-method" name="method" defaultValue={filters.method ?? ""}>
            <option value="">{t.anyMethod}</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-status">{t.status}</Label>
          <NativeSelect id="filter-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">{t.anyStatus}</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t.statuses[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-party">{t.party}</Label>
          <NativeSelect id="filter-party" name="party" defaultValue={filters.party ?? ""}>
            <option value="">{t.anyParty}</option>
            {parties.some((p) => p.kind === "customer") ? (
              <optgroup label={copy.people.customer.title}>
                {parties
                  .filter((p) => p.kind === "customer")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            {parties.some((p) => p.kind === "supplier") ? (
              <optgroup label={copy.people.supplier.title}>
                {parties
                  .filter((p) => p.kind === "supplier")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
          </NativeSelect>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-from">{t.from}</Label>
            <Input id="filter-from" name="from" type="date" defaultValue={filters.from ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-to">{t.to}</Label>
            <Input id="filter-to" name="to" type="date" defaultValue={filters.to ?? ""} />
          </div>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit">{t.apply}</Button>
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href="/transactions">
                <X aria-hidden />
                {t.clear}
              </Link>
            </Button>
          ) : null}
        </div>
      </form>

      {transactions.length === 0 ? (
        <p className="rounded-card border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {t.emptyFiltered}
        </p>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={transactions}
            getRowId={(x) => `${x.type}-${x.id}`}
            searchPlaceholder={t.searchPlaceholder}
            rowHref={transactionHref}
            renderCard={(x) => <TransactionCard tx={x} currencyCode={currencyCode} />}
          />
          {capped ? (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {t.showingLatest(capped)}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
