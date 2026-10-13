import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ACCENTS, type Accent } from "@/components/money/accent";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/lib/copy";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "../queries";
import { ACTIVITY_KINDS, type ActivityKind } from "../schema";

const t = copy.settings.activity;

const KIND_ACCENT: Record<ActivityKind, Accent> = {
  sales: "sales",
  purchases: "purchases",
  customer_payments: "in",
  supplier_payments: "out",
  expenses: "expenses",
  cash_adjustments: "cash",
  businesses: "collect",
};

const MONEY_FIELDS = new Set(["total", "amount", "discount_amount", "starting_cash_balance"]);
const DATE_FIELDS = new Set([
  "sale_date",
  "purchase_date",
  "payment_date",
  "expense_date",
  "entry_date",
  "due_date",
  "starting_balance_date",
]);

function otherMoneyKind(value: string | null): string | null {
  if (!value) return null;
  const kinds: Record<string, string> = copy.otherMoney.types;
  return kinds[value] ?? value;
}

/** A stored value as words: money with the currency, dates, method and kind labels. */
function showValue(field: string, value: string | null, currencyCode: string): string {
  if (value === null || value === "") return t.empty_value;
  if (MONEY_FIELDS.has(field) && /^-?\d+(\.\d+)?$/.test(value))
    return formatMoney(value, currencyCode);
  if (DATE_FIELDS.has(field) && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  if (field === "method") return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
  if (field === "type") return otherMoneyKind(value) ?? value;
  if (field === "direction") return value === "in" ? copy.otherMoney.in : copy.otherMoney.out;
  return value;
}

function entryHref(e: ActivityEntry): string {
  switch (e.kind) {
    case "sales":
      return `/sales/${e.recordId}`;
    case "purchases":
      return `/purchases/${e.recordId}`;
    case "customer_payments":
      return e.parentId ? `/sales/${e.parentId}` : "/sales";
    case "supplier_payments":
      return e.parentId ? `/purchases/${e.parentId}` : "/purchases";
    case "expenses":
      return `/expenses?open=${e.recordId}`;
    case "cash_adjustments":
      return `/money?open=${e.recordId}`;
    case "businesses":
      return "/settings/business";
  }
}

export function ActivityFilter({ kind }: { kind: ActivityKind | undefined }) {
  const options: (ActivityKind | "all")[] = ["all", ...ACTIVITY_KINDS];
  return (
    <nav aria-label={t.filter} className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="inline-flex gap-0.5 rounded-full bg-muted p-1 ring-1 ring-border/60 ring-inset">
        {options.map((k) => {
          const current = (kind ?? "all") === k;
          return (
            <Link
              key={k}
              href={k === "all" ? "/settings/activity" : `/settings/activity?kind=${k}`}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap sm:min-h-9",
                current
                  ? "bg-card font-semibold text-primary shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.kinds[k]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** The audit log as a readable timeline. Read-only. */
export function ActivityList({
  entries,
  currencyCode,
  timezone,
}: {
  entries: ActivityEntry[];
  currencyCode: string;
  timezone: string;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-soft">
      {entries.map((e) => {
        const a = ACCENTS[e.action === "void" ? "loss" : KIND_ACCENT[e.kind]];
        const Icon = a.icon;
        const label = e.kind === "cash_adjustments" ? otherMoneyKind(e.label) : e.label;
        return (
          <li key={e.id} className="px-4 py-4">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  a.chip,
                )}
              >
                <Icon aria-hidden className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge
                    variant={
                      e.action === "void" ? "danger" : e.action === "update" ? "warning" : "success"
                    }
                  >
                    {t.actions[e.action]}
                  </Badge>
                  <span className="font-medium">{t.entryKinds[e.kind]}</span>
                  {label ? <span className="text-muted-foreground">· {label}</span> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(e.createdAt, timezone)} · {t.by(e.actorName ?? t.unknownPerson)}
                </p>
                {e.reason && e.action === "void" ? (
                  <p className="mt-1 text-sm">{t.reason(e.reason)}</p>
                ) : null}
                {e.changes.length > 0 ? (
                  <details className="mt-2 text-sm">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-primary">
                      {t.changes} ({e.changes.length})
                    </summary>
                    <div className="mt-1 overflow-x-auto rounded-control border border-border">
                      <table className="w-full text-left">
                        <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
                          <tr>
                            <th scope="col" className="px-3 py-2 font-semibold" />
                            <th scope="col" className="px-3 py-2 font-semibold">
                              {t.before}
                            </th>
                            <th scope="col" className="px-3 py-2 font-semibold">
                              {t.after}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.changes.map((c) => (
                            <tr key={c.field} className="border-t border-border align-top">
                              <th scope="row" className="px-3 py-2 font-medium whitespace-nowrap">
                                {t.fields[c.field] ?? c.field}
                              </th>
                              <td className="px-3 py-2 text-muted-foreground amount line-through decoration-muted-foreground/40">
                                {showValue(c.field, c.old, currencyCode)}
                              </td>
                              <td className="px-3 py-2 amount">
                                {showValue(c.field, c.new, currencyCode)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {e.amount ? (
                  <span className="font-semibold whitespace-nowrap amount">
                    {formatMoney(e.amount, currencyCode)}
                  </span>
                ) : null}
                <Link
                  href={entryHref(e)}
                  aria-label={`${t.open}: ${t.entryKinds[e.kind]} ${label ?? ""}`.trim()}
                  className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ChevronRight aria-hidden className="size-5" />
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
