import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";

/** Payment method shown as a small pill on every payment row (SPEC Section 10). */
export function MethodPill({ method }: { method: PaymentMethod }) {
  const m =
    PAYMENT_METHODS.find((x) => x.value === method) ?? PAYMENT_METHODS[PAYMENT_METHODS.length - 1];
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground">
      <Icon aria-hidden className="size-3.5" style={{ color: m.color }} />
      {m.label}
    </span>
  );
}
