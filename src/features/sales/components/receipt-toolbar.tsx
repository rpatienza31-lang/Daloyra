"use client";

import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { RECEIPT_SIZES, type ReceiptSize } from "./receipt";

const r = copy.receipt;

/** Size switch, Print and Back. Hidden when printing. */
export function ReceiptToolbar({ saleId, size }: { saleId: string; size: ReceiptSize }) {
  return (
    <div className="mx-auto mb-6 flex w-full max-w-2xl flex-col gap-3 px-4 print:hidden">
      <Link
        href={`/sales/${saleId}`}
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {r.back}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <nav
          aria-label={r.sizeLabel}
          className="inline-flex flex-wrap gap-0.5 rounded-full bg-muted p-1 ring-1 ring-border/60 ring-inset"
        >
          {RECEIPT_SIZES.map((s) => (
            <Link
              key={s}
              href={`/receipts/${saleId}?size=${s}`}
              aria-current={s === size ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium sm:min-h-9",
                s === size
                  ? "bg-card font-semibold text-primary shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.sizes[s]}
            </Link>
          ))}
        </nav>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden />
          {r.print}
        </Button>
      </div>
      {size === "a4" ? <p className="text-sm text-muted-foreground">{r.pdfHint}</p> : null}
    </div>
  );
}
