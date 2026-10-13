import { Badge } from "@/components/ui/badge";
import { copy } from "@/lib/copy";

type PaymentStatus = "paid" | "partial" | "unpaid" | "voided";
type DueStatus = "overdue" | "due_soon" | "not_due" | "no_due_date";

/**
 * Status pills (SPEC Section 12): Paid green, Partially Paid amber, Unpaid gray,
 * Overdue red, Voided muted and struck through. Words carry the meaning, not only color.
 */
export function SaleStatusPill({
  paymentStatus,
  dueStatus,
}: {
  paymentStatus: PaymentStatus;
  dueStatus: DueStatus | null;
}) {
  const s = copy.sales.status;
  if (paymentStatus === "voided") {
    return (
      <Badge variant="muted" className="line-through">
        {s.voided}
      </Badge>
    );
  }
  if (paymentStatus === "paid") return <Badge variant="success">{s.paid}</Badge>;
  if (dueStatus === "overdue") return <Badge variant="danger">{s.overdue}</Badge>;
  if (paymentStatus === "partial") return <Badge variant="warning">{s.partial}</Badge>;
  return <Badge variant="muted">{s.unpaid}</Badge>;
}

export function DueStatusText({ dueStatus }: { dueStatus: DueStatus | null }) {
  if (!dueStatus || dueStatus === "no_due_date") return null;
  const tone =
    dueStatus === "overdue"
      ? "text-money-out"
      : dueStatus === "due_soon"
        ? "text-warning"
        : "text-muted-foreground";
  return <span className={`text-xs font-medium ${tone}`}>{copy.sales.due[dueStatus]}</span>;
}
