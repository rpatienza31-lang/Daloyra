"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import { Info } from "lucide-react";

/**
 * A small info icon that explains a figure in one sentence (SPEC Section 11).
 * A popover rather than a hover tooltip, so it also works with a tap on phones.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        aria-label={label}
        className="-m-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Info aria-hidden className="size-4" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="center"
          sideOffset={4}
          collisionPadding={16}
          className="z-50 max-w-64 rounded-control border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-soft"
        >
          {children}
          <PopoverPrimitive.Arrow className="fill-popover" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
