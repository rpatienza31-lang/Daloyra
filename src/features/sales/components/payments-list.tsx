"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { MethodPill } from "@/components/money/method-pill";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { voidPayment } from "../actions";
import type { SalePayment } from "../queries";

const s = copy.sales;

export function PaymentsList({
  saleId,
  payments,
  currencyCode,
  canVoid,
}: {
  saleId: string;
  payments: SalePayment[];
  currencyCode: string;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<SalePayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (payments.length === 0) {
    return (
      <p className="rounded-card border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        {s.noPayments}
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-card border border-border bg-card">
        {payments.map((p) => {
          const voided = p.voidedAt !== null;
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-semibold amount",
                    voided ? "text-muted-foreground line-through" : "text-money-in",
                  )}
                >
                  +{formatMoney(p.amount, currencyCode)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(p.paymentDate)}
                  {p.reference ? ` · ${p.reference}` : ""}
                </p>
                {p.amountReceived && p.change ? (
                  <p className="text-sm text-muted-foreground amount">
                    {s.cashReceived} {formatMoney(p.amountReceived, currencyCode)} · {s.change}{" "}
                    {formatMoney(p.change, currencyCode)}
                  </p>
                ) : null}
                {voided && p.voidReason ? (
                  <p className="text-xs text-muted-foreground">{s.voidedBy(p.voidReason)}</p>
                ) : null}
              </div>
              <MethodPill method={p.method} />
              {canVoid && !voided ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${s.voidPaymentTitle} ${formatMoney(p.amount, currencyCode)}`}
                  onClick={() => setTarget(p)}
                >
                  <Ban aria-hidden />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <ReasonDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setError(null);
          }
        }}
        title={s.voidPaymentTitle}
        body={target ? s.voidPaymentBody(formatMoney(target.amount, currencyCode)) : ""}
        pending={pending}
        error={error}
        onConfirm={(reason) =>
          target &&
          startTransition(async () => {
            const result = await voidPayment(target.id, saleId, reason);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setTarget(null);
            toast.success(s.paymentVoided);
            router.refresh();
          })
        }
      />
    </>
  );
}
