"use client";

import { useState } from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Confirms a destructive money action. The body states the consequence in numbers
 * (SPEC Section 11) and a reason is required (SPEC 2.1 #6).
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  body,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error ?? undefined;
  const s = copy.sales;

  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          setLocalError(null);
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-card p-6 shadow-soft">
          <AlertDialogPrimitive.Title className="font-heading text-lg font-bold">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
            {body}
          </AlertDialogPrimitive.Description>
          <div className="mt-4">
            <FormField id="void-reason" label={s.voidReason} error={shownError}>
              <Textarea
                id="void-reason"
                value={reason}
                placeholder={s.voidReasonPlaceholder}
                maxLength={300}
                className="min-h-20"
                aria-invalid={Boolean(shownError)}
                aria-describedby={describedBy("void-reason", shownError)}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel className={buttonVariants({ variant: "outline" })}>
              {s.keep}
            </AlertDialogPrimitive.Cancel>
            <button
              type="button"
              disabled={pending}
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={() => {
                if (!reason.trim()) {
                  setLocalError(s.errors.reasonRequired);
                  return;
                }
                setLocalError(null);
                onConfirm(reason.trim());
              }}
            >
              {pending ? copy.common.saving : s.voidConfirm}
            </button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
