import * as React from "react";
import type { LucideIcon } from "lucide-react";

/** Every empty page explains what it is for and offers one action (SPEC Section 11). */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
        <Icon aria-hidden className="size-6 text-primary" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {body ? <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
