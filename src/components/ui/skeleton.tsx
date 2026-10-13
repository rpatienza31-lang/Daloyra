import { cn } from "@/lib/utils";

/** A placeholder block shown while a page loads (SPEC Section 11). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-muted", className)} />;
}
