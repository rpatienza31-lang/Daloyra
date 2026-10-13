"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { copy } from "@/lib/copy";
import { NEW_MONEY_ITEMS, NEW_PEOPLE_ITEMS, type NewItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** "+ New": the bottom bar's centre button on phones, a top-bar button on desktop. */
export function NewSheet({ variant }: { variant: "fab" | "button" }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {variant === "fab" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={copy.nav.new}
          className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus aria-hidden className="size-7" />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          {copy.nav.new}
        </Button>
      )}
      <SheetContent side="bottom" title={copy.nav.newTitle} className="md:mx-auto md:max-w-lg">
        <Section title={copy.nav.newMoney} items={NEW_MONEY_ITEMS} onPick={() => setOpen(false)} />
        <Section
          title={copy.nav.newPeople}
          items={NEW_PEOPLE_ITEMS}
          onPick={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  items,
  onPick,
}: {
  title: string;
  items: NewItem[];
  onPick: () => void;
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const inner = (
            <>
              <Icon aria-hidden className="size-6" />
              <span className="text-sm font-medium">{item.label}</span>
              {item.href ? null : (
                <span className="text-xs text-muted-foreground">{copy.nav.comingSoon}</span>
              )}
            </>
          );
          const cls =
            "flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border border-border p-3 text-center";
          return (
            <li key={item.key}>
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={onPick}
                  className={cn(
                    cls,
                    "text-foreground hover:border-primary hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  )}
                >
                  {inner}
                </Link>
              ) : (
                <div className={cn(cls, "text-text-muted")} aria-disabled>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
