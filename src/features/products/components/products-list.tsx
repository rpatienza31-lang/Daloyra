"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/layout/empty-state";
import { StatCard } from "@/components/money/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { InventoryTotals } from "../queries";
import type { Product } from "../schema";
import { ProductFormSheet } from "./product-form-sheet";
import { StockBadge } from "./stock-badge";

interface Props {
  products: Product[];
  totals: InventoryTotals;
  showArchived: boolean;
  canManage: boolean;
  currencyCode: string;
  startAdding: boolean;
}

const t = copy.products;

const NUMERIC = [
  "sellingPrice",
  "received",
  "sold",
  "adjusted",
  "onHand",
  "costReceived",
  "averageCost",
  "currentValue",
] as const;

export function ProductsList({
  products,
  totals,
  showArchived,
  canManage,
  currencyCode,
  startAdding,
}: Props) {
  const [adding, setAdding] = useState(startAdding && canManage);
  const money = (value: string) => formatMoney(value, currencyCode);

  const qty = (value: string, unit: string) => `${value} ${unit}`;
  const columns: DataTableColumn<Product>[] = [
    { accessorKey: "name", header: t.columns.product },
    {
      accessorKey: "sellingPrice",
      header: t.columns.sellingPrice,
      cell: ({ getValue }) => money(String(getValue())),
    },
    ...(canManage
      ? ([
          {
            accessorKey: "received",
            header: t.columns.received,
            cell: ({ row }) => qty(row.original.received, row.original.unit),
          },
          {
            accessorKey: "sold",
            header: t.columns.sold,
            cell: ({ row }) => qty(row.original.sold, row.original.unit),
          },
          {
            accessorKey: "adjusted",
            header: t.columns.adjusted,
            cell: ({ row }) =>
              row.original.adjusted === "0" ? "—" : qty(row.original.adjusted, row.original.unit),
          },
        ] satisfies DataTableColumn<Product>[])
      : []),
    {
      accessorKey: "onHand",
      header: t.columns.onHand,
      cell: ({ row }) => <StockBadge onHand={row.original.onHand} unit={row.original.unit} />,
    },
    ...(canManage
      ? ([
          {
            accessorKey: "costReceived",
            header: t.columns.costReceived,
            cell: ({ getValue }) => money(String(getValue())),
          },
          {
            accessorKey: "averageCost",
            header: t.columns.averageCost,
            cell: ({ row }) => (row.original.averageCost ? money(row.original.averageCost) : "—"),
          },
        ] satisfies DataTableColumn<Product>[])
      : []),
    {
      accessorKey: "currentValue",
      header: t.columns.currentValue,
      cell: ({ getValue }) => <span className="font-semibold">{money(String(getValue()))}</span>,
    },
  ];

  const addButton = canManage ? (
    <Button onClick={() => setAdding(true)}>
      <Plus aria-hidden />
      {t.add}
    </Button>
  ) : null;

  return (
    <>
      <PageHeader title={t.title} actions={addButton} />

      <nav
        aria-label={t.title}
        className="mb-4 inline-flex gap-0.5 rounded-full bg-muted p-1 ring-1 ring-border/60 ring-inset"
      >
        {[
          { label: copy.common.active, href: "/products", selected: !showArchived },
          { label: copy.common.archived, href: "/products?show=archived", selected: showArchived },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium",
              tab.selected
                ? "bg-card font-semibold text-primary shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {products.length > 0 ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {canManage ? (
            <StatCard
              label={t.totals.costReceived}
              amount={totals.costReceived}
              currencyCode={currencyCode}
              accent="purchases"
              info={t.totals.costReceivedInfo}
              testId="inventory-cost"
            />
          ) : null}
          <StatCard
            label={t.totals.currentValue}
            amount={totals.currentValue}
            currencyCode={currencyCode}
            accent="sales"
            info={t.totals.currentValueInfo}
            testId="inventory-value"
          />
        </div>
      ) : null}

      {products.length === 0 ? (
        showArchived ? (
          <p className="rounded-card border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {t.emptyArchived}
          </p>
        ) : (
          <EmptyState icon={Boxes} title={t.emptyTitle} body={t.emptyBody} action={addButton} />
        )
      ) : (
        <DataTable
          columns={columns}
          data={products}
          getRowId={(p) => p.id}
          searchPlaceholder={t.searchPlaceholder}
          rowHref={(p) => `/products/${p.id}`}
          numericColumns={NUMERIC}
          renderCard={(p) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground amount">{money(p.sellingPrice)}</p>
                </div>
                <StockBadge onHand={p.onHand} unit={p.unit} />
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground amount">
                {canManage ? (
                  <>
                    <dt>{t.columns.received}</dt>
                    <dd className="text-right">{qty(p.received, p.unit)}</dd>
                    <dt>{t.columns.sold}</dt>
                    <dd className="text-right">{qty(p.sold, p.unit)}</dd>
                    {p.adjusted !== "0" ? (
                      <>
                        <dt>{t.columns.adjusted}</dt>
                        <dd className="text-right">{qty(p.adjusted, p.unit)}</dd>
                      </>
                    ) : null}
                    <dt>{t.columns.costReceived}</dt>
                    <dd className="text-right">{money(p.costReceived)}</dd>
                    <dt>{t.columns.averageCost}</dt>
                    <dd className="text-right">{p.averageCost ? money(p.averageCost) : "—"}</dd>
                  </>
                ) : null}
                <dt className="font-medium text-foreground">{t.columns.currentValue}</dt>
                <dd className="text-right font-semibold text-foreground">
                  {money(p.currentValue)}
                </dd>
              </dl>
            </div>
          )}
        />
      )}

      {products.length > 0 && canManage ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.adjustedHint}</p>
      ) : null}

      <ProductFormSheet open={adding} onOpenChange={setAdding} />
    </>
  );
}
