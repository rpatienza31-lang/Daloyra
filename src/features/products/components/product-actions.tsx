"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, PackagePlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import { setProductArchived } from "../actions";
import type { Product } from "../schema";
import { AdjustStockSheet } from "./adjust-stock-sheet";
import { ProductFormSheet } from "./product-form-sheet";

const t = copy.products;

/** Edit, change stock and archive/restore buttons on a product page. */
export function ProductActions({ product, today }: { product: Product; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const archived = product.archivedAt !== null;

  function setArchived(value: boolean) {
    startTransition(async () => {
      const result = await setProductArchived(product.id, value);
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(value ? t.archivedToast : t.restoredToast);
      router.refresh();
    });
  }

  return (
    <>
      {archived ? null : (
        <Button onClick={() => setAdjusting(true)}>
          <PackagePlus aria-hidden />
          {t.adjust.button}
        </Button>
      )}
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        {copy.common.edit}
      </Button>
      {archived ? (
        <Button variant="outline" disabled={pending} onClick={() => setArchived(false)}>
          <ArchiveRestore aria-hidden />
          {copy.common.restore}
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <Archive aria-hidden />
          {copy.common.archive}
        </Button>
      )}

      <ProductFormSheet open={editing} onOpenChange={setEditing} product={product} />
      <AdjustStockSheet
        open={adjusting}
        onOpenChange={setAdjusting}
        productId={product.id}
        unit={product.unit}
        today={today}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.archiveTitle}
        body={t.archiveBody}
        confirmLabel={copy.common.archive}
        cancelLabel={copy.common.cancel}
        pending={pending}
        onConfirm={() => setArchived(true)}
      />
    </>
  );
}
