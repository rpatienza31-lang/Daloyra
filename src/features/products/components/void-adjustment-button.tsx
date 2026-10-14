"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { copy } from "@/lib/copy";
import { voidStockAdjustment } from "../actions";

const a = copy.products.adjust;

/** Cancels one stock change, with a reason (records are voided, never deleted). */
export function VoidAdjustmentButton({
  productId,
  entryId,
  summary,
}: {
  productId: string;
  entryId: string;
  summary: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center text-sm font-medium text-destructive hover:underline"
      >
        {a.voidLabel}
      </button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={a.voidTitle}
        body={summary}
        pending={pending}
        error={error}
        onConfirm={(reason) =>
          startTransition(async () => {
            const result = await voidStockAdjustment(productId, entryId, reason);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setOpen(false);
            toast.success(a.voided);
            router.refresh();
          })
        }
      />
    </>
  );
}
