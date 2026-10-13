import { MethodPill } from "@/components/money/method-pill";
import { SaleStatusPill } from "@/components/money/sale-status-pill";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Transaction } from "../queries";

const t = copy.transactions;

/** Who or what a row is about: the customer or supplier, the expense category, or the kind. */
export function transactionTitle(tx: Transaction): string {
  if (tx.partyName) return tx.partyName;
  if (tx.type === "sale" || tx.type === "customer_payment") return t.walkIn;
  if (tx.type === "other_in" || tx.type === "other_out") {
    const kinds: Record<string, string> = copy.otherMoney.types;
    return kinds[tx.description ?? ""] ?? t.types[tx.type];
  }
  return t.types[tx.type];
}

/** Reference and first line, e.g. "S-0004 · Rice 25 kg". Other money shows its notes instead. */
export function transactionDetails(tx: Transaction): string {
  const parts = [tx.reference];
  if (tx.type !== "other_in" && tx.type !== "other_out") parts.push(tx.description);
  return parts.filter(Boolean).join(" · ");
}

/**
 * The amount with its direction: money that came in is green with "+", money that went
 * out is red with "−". Sales and purchases are documents, so they show plain.
 */
export function TransactionAmount({
  tx,
  currencyCode,
  className,
}: {
  tx: Transaction;
  currencyCode: string;
  className?: string;
}) {
  const sign = tx.moneyIn ? "+" : tx.moneyOut ? "−" : "";
  return (
    <span
      className={cn(
        "font-semibold whitespace-nowrap amount",
        tx.moneyIn && "text-money-in",
        tx.moneyOut && "text-money-out",
        tx.voidedAt && "text-muted-foreground line-through",
        className,
      )}
    >
      {sign}
      {formatMoney(tx.amount, currencyCode)}
    </span>
  );
}

/** Status for documents, method for movements; voided rows say so. */
export function TransactionStatus({ tx }: { tx: Transaction }) {
  if (tx.voidedAt) {
    return (
      <Badge variant="muted" className="line-through">
        {copy.sales.status.voided}
      </Badge>
    );
  }
  if (tx.status !== "recorded") {
    return <SaleStatusPill paymentStatus={tx.status} dueStatus={tx.dueStatus} />;
  }
  return tx.method ? <MethodPill method={tx.method} /> : null;
}

/** A row as a stacked card (phones, dashboard). */
export function TransactionCard({ tx, currencyCode }: { tx: Transaction; currencyCode: string }) {
  const details = transactionDetails(tx);
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{transactionTitle(tx)}</p>
        <p className="truncate text-sm text-muted-foreground">
          {t.types[tx.type]} · {formatDate(tx.date)}
        </p>
        {details ? <p className="truncate text-xs text-muted-foreground">{details}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <TransactionAmount tx={tx} currencyCode={currencyCode} />
        <TransactionStatus tx={tx} />
      </div>
    </div>
  );
}
