import Link from "next/link";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { compareMoney, formatMoney } from "@/lib/money";
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
      <dl
        className={cn(
          "grid grid-cols-2 gap-3 print:grid-cols-4",
          view.summary.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {view.summary.map((item) => {
          const negative = item.signed && compareMoney(item.amount, "0") < 0;
          const positive = item.signed && compareMoney(item.amount, "0") > 0;
          return (
            <div
              key={item.label}
              className="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-card p-4 shadow-soft print:shadow-none"
            >
              <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{item.label}</dt>
              <dd
                className={cn(
                  "text-lg font-semibold [overflow-wrap:anywhere] amount sm:text-xl",
                  negative && "text-money-out",
                  positive && "text-money-in",
                )}
              >
                {formatMoney(item.amount, currencyCode)}
                {negative ? (
                  <span className="ml-1.5 text-xs font-medium">
                    {copy.app.dashboard.profitLoss}
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>

      {view.rows.length === 0 ? (
        <p className="rounded-card border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {r.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-card print:overflow-visible print:border-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground print:bg-transparent">
              <tr>
                {view.columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-4 py-3 font-medium whitespace-nowrap print:px-2 print:py-1",
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
                    "border-b border-border last:border-0",
                    row.style === "heading" && "bg-muted/30 font-semibold",
                    row.style === "subtotal" && "font-semibold",
                  )}
                >
                  {view.columns.map((col, i) => {
                    const text = display(row.cells[col.key] ?? null, col.kind, currencyCode);
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-2.5 print:px-2 print:py-1",
                          alignRight(col.kind) && "text-right whitespace-nowrap amount",
                          col.kind === "date" && "whitespace-nowrap",
                          i === 0 && row.indent && "pl-8 print:pl-4",
                        )}
                      >
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
              <tfoot className="border-t-2 border-foreground/20 font-semibold">
                <tr>
                  {view.columns.map((col, i) => {
                    const value = view.totals?.[col.key] ?? null;
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3 print:px-2 print:py-1",
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
