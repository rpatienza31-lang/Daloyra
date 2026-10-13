"use client";

import type { DataTableColumn } from "@/components/data-table/data-table";
import { DueStatusText, SaleStatusPill } from "@/components/money/sale-status-pill";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PurchaseSummary } from "../queries";

const s = copy.purchases;

/** Columns for the purchases and To Collect tables. Amounts are strings from Postgres. */
export function purchaseColumns(
  currencyCode: string,
  variant: "purchases" | "payables",
): DataTableColumn<PurchaseSummary>[] {
  const money = (value: string) => formatMoney(value, currencyCode);
  const amount = (value: string, extra?: string) => (
    <span className={cn("amount", extra)}>{money(value)}</span>
  );
  const r = copy.payables.columns;

  if (variant === "payables") {
    return [
      { id: "supplier", accessorFn: (x) => x.supplierName ?? s.noSupplier, header: r.supplier },
      { accessorKey: "referenceNo", header: r.reference },
      {
        accessorKey: "total",
        header: r.original,
        cell: ({ row }) => amount(row.original.total),
        enableSorting: false,
      },
      {
        accessorKey: "amountPaid",
        header: r.paid,
        cell: ({ row }) => amount(row.original.amountPaid),
        enableSorting: false,
      },
      {
        accessorKey: "balance",
        header: r.balance,
        cell: ({ row }) => amount(row.original.balance, "font-semibold"),
        enableSorting: false,
      },
      {
        accessorKey: "dueDate",
        header: r.dueDate,
        cell: ({ row }) => (
          <span className="flex flex-col">
            {row.original.dueDate ? formatDate(row.original.dueDate) : "—"}
            <DueStatusText dueStatus={row.original.dueStatus} />
          </span>
        ),
      },
    ];
  }

  return [
    { accessorKey: "referenceNo", header: s.reference },
    {
      accessorKey: "purchaseDate",
      header: s.date,
      cell: ({ row }) => formatDate(row.original.purchaseDate),
    },
    { id: "supplier", accessorFn: (x) => x.supplierName ?? s.noSupplier, header: s.supplier },
    {
      accessorKey: "total",
      header: s.total,
      enableSorting: false,
      cell: ({ row }) =>
        amount(
          row.original.total,
          row.original.paymentStatus === "voided"
            ? "text-muted-foreground line-through"
            : undefined,
        ),
    },
    {
      accessorKey: "balance",
      header: s.balance,
      enableSorting: false,
      cell: ({ row }) => amount(row.original.balance),
    },
    {
      id: "status",
      header: copy.payables.columns.status,
      enableSorting: false,
      cell: ({ row }) => (
        <SaleStatusPill
          paymentStatus={row.original.paymentStatus}
          dueStatus={row.original.dueStatus}
        />
      ),
    },
  ];
}

/** How a purchase looks as a card on phones. */
export function PurchaseCard({
  purchase,
  currencyCode,
  showDue,
}: {
  purchase: PurchaseSummary;
  currencyCode: string;
  showDue?: boolean;
}) {
  const voided = purchase.paymentStatus === "voided";
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{purchase.supplierName ?? s.noSupplier}</p>
        <p className="text-sm text-muted-foreground">
          {purchase.referenceNo} · {formatDate(purchase.purchaseDate)}
        </p>
        {showDue && purchase.dueDate ? (
          <p className="text-sm">
            {s.dueDate}: {formatDate(purchase.dueDate)}{" "}
            <DueStatusText dueStatus={purchase.dueStatus} />
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn("font-semibold amount", voided && "text-muted-foreground line-through")}
        >
          {formatMoney(showDue ? purchase.balance : purchase.total, currencyCode)}
        </span>
        <SaleStatusPill paymentStatus={purchase.paymentStatus} dueStatus={purchase.dueStatus} />
      </div>
    </div>
  );
}
