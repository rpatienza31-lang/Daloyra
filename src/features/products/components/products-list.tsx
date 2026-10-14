"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Product } from "../schema";
import { ProductFormSheet } from "./product-form-sheet";
import { StockBadge } from "./stock-badge";

interface Props {
  products: Product[];
  showArchived: boolean;
  canManage: boolean;
  currencyCode: string;
  startAdding: boolean;
}

const t = copy.products;

export function ProductsList({
  products,
  showArchived,
  canManage,
  currencyCode,
  startAdding,
}: Props) {
  const [adding, setAdding] = useState(startAdding && canManage);
  const money = (value: string) => formatMoney(value, currencyCode);

  const columns: DataTableColumn<Product>[] = [
    { accessorKey: "name", header: t.columns.product },
    {
      accessorKey: "sellingPrice",
      header: t.columns.sellingPrice,
      cell: ({ getValue }) => <span className="amount">{money(String(getValue()))}</span>,
    },
    ...(canManage
      ? ([
          {
            accessorKey: "currentCost",
            header: t.columns.cost,
            cell: ({ getValue }) => <span className="amount">{money(String(getValue()))}</span>,
          },
        ] satisfies DataTableColumn<Product>[])
      : []),
    {
      accessorKey: "onHand",
      header: t.columns.inStock,
      cell: ({ row }) => <StockBadge onHand={row.original.onHand} unit={row.original.unit} />,
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
          renderCard={(p) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground amount">{money(p.sellingPrice)}</p>
              </div>
              <StockBadge onHand={p.onHand} unit={p.unit} />
            </div>
          )}
        />
      )}

      <ProductFormSheet open={adding} onOpenChange={setAdding} />
    </>
  );
}
