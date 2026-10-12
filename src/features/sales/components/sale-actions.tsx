"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, HandCoins, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";
import { voidSale } from "../actions";
import { RecordPaymentSheet } from "./record-payment-sheet";

const s = copy.sales;

/** The sale page's actions: Record payment, Edit, Cancel (Void). */
export function SaleActions({
  saleId,
  referenceNo,
  total,
  amountPaid,
  activePayments,
  balance,
  saleDate,
  today,
  currencyCode,
  canRecord,
  canEdit,
  canVoid,
}: {
  saleId: string;
  referenceNo: string;
  total: string;
  amountPaid: string;
  activePayments: number;
  balance: string;
  saleDate: string;
  today: string;
  currencyCode: string;
  canRecord: boolean;
  canEdit: boolean;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const money = (value: string) => formatMoney(value, currencyCode);

  return (
    <>
      {canRecord ? (
        <Button onClick={() => setPaying(true)}>
          <HandCoins aria-hidden />
          {s.recordPayment}
        </Button>
      ) : null}
      {canEdit ? (
        <Button asChild variant="outline">
          <Link href={`/sales/${saleId}/edit`}>
            <Pencil aria-hidden />
            {copy.common.edit}
          </Link>
        </Button>
      ) : null}
      {canVoid ? (
        <Button variant="outline" onClick={() => setVoiding(true)}>
          <Ban aria-hidden />
          {s.voidSale}
        </Button>
      ) : null}

      <RecordPaymentSheet
        open={paying}
        onOpenChange={setPaying}
        saleId={saleId}
        balance={balance}
        saleDate={saleDate}
        today={today}
        currencyCode={currencyCode}
      />
      <ReasonDialog
        open={voiding}
        onOpenChange={(open) => {
          setVoiding(open);
          if (!open) setVoidError(null);
        }}
        title={s.voidTitle}
        body={s.voidBody(referenceNo, money(total), activePayments, money(amountPaid))}
        pending={pending}
        error={voidError}
        onConfirm={(reason) =>
          startTransition(async () => {
            const result = await voidSale(saleId, reason);
            if (!result.ok) {
              setVoidError(result.error);
              return;
            }
            setVoiding(false);
            toast.success(s.voided);
            router.refresh();
          })
        }
      />
    </>
  );
}
