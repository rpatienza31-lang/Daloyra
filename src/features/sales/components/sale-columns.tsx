"use client";

import type { DataTableColumn } from "@/components/data-table/data-table";
import { DueStatusText, SaleStatusPill } from "@/components/money/sale-status-pill";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SaleSummary } from "../queries";

const s = copy.sales;

/** Columns for the sales and To Collect tables. Amounts are strings from Postgres. */
export function saleColumns(
  currencyCode: string,
  variant: "sales" | "receivables",
): DataTableColumn<SaleSummary>[] {
  const money = (value: string) => formatMoney(value, currencyCode);
  const amount = (value: string, extra?: string) => (
    <span className={cn("amount", extra)}>{money(value)}</span>
  );
  const r = copy.receivables.columns;

  if (variant === "receivables") {
    return [
      { id: "customer", accessorFn: (x) => x.customerName ?? s.walkIn, header: r.customer },
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
      accessorKey: "saleDate",
      header: s.date,
      cell: ({ row }) => formatDate(row.original.saleDate),
    },
    { id: "customer", accessorFn: (x) => x.customerName ?? s.walkIn, header: s.customer },
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
      header: copy.receivables.columns.status,
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

/** How a sale looks as a card on phones. */
export function SaleCard({
  sale,
  currencyCode,
  showDue,
}: {
  sale: SaleSummary;
  currencyCode: string;
  showDue?: boolean;
}) {
  const voided = sale.paymentStatus === "voided";
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{sale.customerName ?? s.walkIn}</p>
        <p className="text-sm text-muted-foreground">
          {sale.referenceNo} · {formatDate(sale.saleDate)}
        </p>
        {showDue && sale.dueDate ? (
          <p className="text-sm">
            {s.dueDate}: {formatDate(sale.dueDate)} <DueStatusText dueStatus={sale.dueStatus} />
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn("font-semibold amount", voided && "text-muted-foreground line-through")}
        >
          {formatMoney(showDue ? sale.balance : sale.total, currencyCode)}
        </span>
        <SaleStatusPill paymentStatus={sale.paymentStatus} dueStatus={sale.dueStatus} />
      </div>
    </div>
  );
}
