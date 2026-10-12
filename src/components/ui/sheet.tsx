"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

type Side = "bottom" | "right";

const sideClasses: Record<Side, string> = {
  bottom:
    "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-card border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  right:
    "inset-y-0 right-0 h-full w-full border-l sm:max-w-md data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
};

function SheetContent({
  side = "right",
  title,
  description,
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: Side;
  title: string;
  description?: string;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/30 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col overflow-y-auto border-border bg-card shadow-soft duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in",
          sideClasses[side],
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div>
            <SheetPrimitive.Title className="font-heading text-lg font-bold">
              {title}
            </SheetPrimitive.Title>
            {description ? (
              <SheetPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </SheetPrimitive.Description>
            ) : null}
          </div>
          <SheetPrimitive.Close
            className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label={copy.common.close}
          >
            <X aria-hidden className="size-5" />
          </SheetPrimitive.Close>
        </div>
        <div className="flex-1 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
