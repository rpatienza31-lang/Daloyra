import Link from "next/link";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { ACCENTS } from "@/components/money/accent";
import { StatCard } from "@/components/money/stat-card";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ColumnKind, ReportView } from "../model";

const r = copy.reports;

function display(value: string | null, kind: ColumnKind, currencyCode: string): string {
  if (value === null) return "";
  if (kind === "money") return formatMoney(value, currencyCode);
  if (kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  return value;
}

const alignRight = (kind: ColumnKind) => kind === "money" || kind === "number";

/** Summary figures, the table and its totals row. Screen and print share this layout. */
export function ReportTable({ view, currencyCode }: { view: ReportView; currencyCode: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "grid grid-cols-2 gap-3 print:grid-cols-4",
          view.summary.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {view.summary.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            amount={item.amount}
            currencyCode={currencyCode}
            accent={item.accent}
            signed={item.signed}
            highlight={item.accent === "profit"}
          />
        ))}
      </div>

      {view.rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {r.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-card shadow-soft print:overflow-visible print:border-0 print:shadow-none">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/60 text-left text-xs tracking-wide text-muted-foreground uppercase print:bg-transparent">
              <tr>
                {view.columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-4 py-3 font-semibold whitespace-nowrap print:px-2 print:py-1",
                      alignRight(col.kind) && "text-right",
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b border-border transition-colors last:border-0",
                    row.style === "heading" && "bg-muted/40 font-semibold",
                    row.style === "subtotal" && "font-semibold",
                    !row.style && "hover:bg-muted/30",
                  )}
                >
                  {view.columns.map((col, i) => {
                    const text = display(row.cells[col.key] ?? null, col.kind, currencyCode);
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3 print:px-2 print:py-1",
                          alignRight(col.kind) && "text-right whitespace-nowrap amount",
                          col.kind === "date" && "whitespace-nowrap",
                          i === 0 && row.indent && "pl-8 print:pl-4",
                        )}
                      >
                        {i === 0 && row.accent ? (
                          <span
                            aria-hidden
                            className={cn(
                              "mr-2.5 inline-block size-2.5 rounded-full align-middle",
                              ACCENTS[row.accent].dot,
                            )}
                          />
                        ) : null}
                        {i === 0 && row.href ? (
                          <Link
                            href={row.href}
                            className="font-medium text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none print:text-foreground print:no-underline"
                          >
                            {text}
                          </Link>
                        ) : (
                          text
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {view.totals ? (
              <tfoot
                className={cn(
                  "border-t-2 border-foreground/15 font-bold",
                  view.totalsTone === "profit" && "bg-profit-tint text-money-in",
                  view.totalsTone === "loss" && "bg-loss-tint text-money-out",
                  !view.totalsTone && "bg-muted/40",
                )}
              >
                <tr>
                  {view.columns.map((col, i) => {
                    const value = view.totals?.[col.key] ?? null;
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3.5 print:px-2 print:py-1",
                          view.totalsTone && "text-base",
                          alignRight(col.kind) && "text-right whitespace-nowrap amount",
                          col.kind === "money" &&
                            value !== null &&
                            value.startsWith("-") &&
                            "text-money-out",
                        )}
                      >
                        {i === 0 ? value : display(value, col.kind, currencyCode)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
      {view.note ? <p className="text-sm text-muted-foreground">{view.note}</p> : null}
    </div>
  );
}
