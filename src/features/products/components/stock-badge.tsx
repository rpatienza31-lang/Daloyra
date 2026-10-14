import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/** Stock on hand with its unit; zero or below is shown as a warning. */
export function StockBadge({ onHand, unit }: { onHand: string; unit: string }) {
  const out = onHand.startsWith("-") || /^0+(\.0*)?$/.test(onHand);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap amount",
        out ? "bg-warning/15 text-warning-ink" : "bg-muted text-foreground",
      )}
    >
      {out && !onHand.startsWith("-") ? copy.products.lowStock : `${onHand} ${unit}`}
    </span>
  );
}
