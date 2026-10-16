"use client";

import * as React from "react";
import Link from "next/link";
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  flexRender,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/** Case-insensitive "contains" that also searches empty (null) columns safely. */
function containsText(
  row: { getValue: (columnId: string) => unknown },
  columnId: string,
  value: unknown,
): boolean {
  return String(row.getValue(columnId) ?? "")
    .toLowerCase()
    .includes(String(value).trim().toLowerCase());
}

/** Table features shared by every list: client-side sorting and search. */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  filterFns: { containsText },
});

export type DataTableColumn<T extends RowData> = ColumnDef<typeof dataTableFeatures, T>;

interface DataTableProps<T extends RowData> {
  /** Keep this stable (module scope or useMemo). */
  columns: DataTableColumn<T>[];
  data: T[];
  /** Shown above the table; filters every visible column. */
  searchPlaceholder?: string;
  /** How a row looks as a stacked card under 768 px. */
  renderCard: (row: T) => React.ReactNode;
  /** Makes each row (and card) a link. */
  rowHref?: (row: T) => string;
  /** Or: makes each row (and card) a button, e.g. to open a side sheet. */
  onRowClick?: (row: T) => void;
  getRowId: (row: T) => string;
  /** Column ids of numbers and amounts: right-aligned on one line. */
  numericColumns?: readonly string[];
}

/**
 * A searchable, sortable table that becomes stacked cards on phones (SPEC Section 12).
 * Data is passed in already filtered by the server; this only sorts and searches.
 */
export function DataTable<T extends RowData>({
  columns,
  data,
  searchPlaceholder,
  renderCard,
  rowHref,
  onRowClick,
  getRowId,
  numericColumns = [],
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "containsText",
    getColumnCanGlobalFilter: () => true,
    getRowId,
  });
  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-4">
      {searchPlaceholder ? (
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="pl-9"
          />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {copy.common.noMatches}
        </p>
      ) : (
        <>
          {/* Phones: stacked cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((row) => {
              const href = rowHref?.(row.original);
              const body = (
                <>
                  <div className="min-w-0 flex-1">{renderCard(row.original)}</div>
                  {href || onRowClick ? (
                    <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
                  ) : null}
                </>
              );
              return (
                <li key={row.id}>
                  {href ? (
                    <Link
                      href={href}
                      className="flex min-h-11 items-center gap-3 rounded-card border border-border bg-card px-4 py-3 shadow-soft transition-shadow hover:shadow-lift focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {body}
                    </Link>
                  ) : onRowClick ? (
                    <button
                      type="button"
                      onClick={() => onRowClick(row.original)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-card border border-border bg-card px-4 py-3 text-left shadow-soft transition-shadow hover:shadow-lift focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Tablets and up: a table */}
          <div className="hidden overflow-x-auto rounded-card border border-border bg-card shadow-soft md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            sorted === "asc"
                              ? "ascending"
                              : sorted === "desc"
                                ? "descending"
                                : undefined
                          }
                          className={cn(
                            "px-4 py-3 font-medium",
                            numericColumns.includes(header.column.id) &&
                              "text-right whitespace-nowrap",
                          )}
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === "asc" ? (
                                <ArrowUp aria-hidden className="size-3.5" />
                              ) : null}
                              {sorted === "desc" ? (
                                <ArrowDown aria-hidden className="size-3.5" />
                              ) : null}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = rowHref?.(row.original);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border transition-colors last:border-0",
                        (href || onRowClick) && "hover:bg-muted/40",
                      )}
                    >
                      {row.getAllCells().map((cell, i) => (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-4 py-3.5 align-middle",
                            numericColumns.includes(cell.column.id) &&
                              "text-right whitespace-nowrap amount",
                          )}
                        >
                          {href && i === 0 ? (
                            <Link
                              href={href}
                              className="font-medium text-foreground hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </Link>
                          ) : onRowClick && i === 0 ? (
                            <button
                              type="button"
                              onClick={() => onRowClick(row.original)}
                              className="text-left font-medium text-foreground hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </button>
                          ) : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
