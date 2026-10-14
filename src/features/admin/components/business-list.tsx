"use client";

import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { formatWhen } from "../format";
import type { AdminBusiness } from "../queries";
import { ACCESS_STATES, type AccessState } from "../schema";
import { AccessBadge } from "./access-badge";

const t = copy.admin;

/** All businesses, filterable by status and searchable by name, owner or email. */
export function BusinessList({ businesses }: { businesses: AdminBusiness[] }) {
  const [filter, setFilter] = useState<AccessState | "all">("all");
  const rows = useMemo(
    () => (filter === "all" ? businesses : businesses.filter((b) => b.access === filter)),
    [businesses, filter],
  );
  const columns = useMemo<DataTableColumn<AdminBusiness>[]>(
    () => [
      { accessorKey: "name", header: t.columns.business },
      {
        id: "owner",
        accessorFn: (b) => `${b.ownerName ?? ""} ${b.ownerEmail ?? ""}`,
        header: t.columns.owner,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{row.original.ownerName ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.ownerEmail}</p>
          </div>
        ),
      },
      {
        accessorKey: "access",
        header: t.columns.access,
        cell: ({ row }) => <AccessBadge access={row.original.access} />,
      },
      {
        accessorKey: "createdAt",
        header: t.columns.signedUp,
        cell: ({ row }) => formatWhen(row.original.createdAt),
      },
      {
        accessorKey: "lastActivity",
        header: t.columns.lastActive,
        cell: ({ row }) => formatWhen(row.original.lastActivity),
      },
      {
        id: "records",
        accessorFn: (b) => b.sales + b.purchases + b.expenses,
        header: t.columns.records,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {t.recordsSummary(row.original.sales, row.original.purchases, row.original.expenses)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t.columns.access} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-0.5 rounded-full bg-muted p-1 ring-1 ring-border/60 ring-inset">
          {(["all", ...ACCESS_STATES] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap sm:min-h-9",
                filter === f
                  ? "bg-card font-semibold text-primary shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? t.cards.total : t.access[f]}
            </button>
          ))}
        </div>
      </nav>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(b) => b.id}
        searchPlaceholder={t.search}
        rowHref={(b) => `/admin/businesses/${b.id}`}
        renderCard={(b) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{b.name}</p>
              <p className="truncate text-sm text-muted-foreground">{b.ownerEmail}</p>
              <p className="text-xs text-muted-foreground">
                {t.recordsSummary(b.sales, b.purchases, b.expenses)}
              </p>
            </div>
            <AccessBadge access={b.access} />
          </div>
        )}
      />
    </div>
  );
}
