import {
  Banknote,
  CreditCard,
  Landmark,
  MoreHorizontal,
  ScrollText,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The single list of payment methods (SPEC Section 7.3).
 * Values match the CHECK constraint in the database.
 */
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote, color: "#16A34A" },
  { value: "gcash", label: "GCash", icon: Smartphone, color: "#2563EB" },
  { value: "maya", label: "Maya", icon: Wallet, color: "#059669" },
  { value: "bank_transfer", label: "Online Bank", icon: Landmark, color: "#0F6B74" },
  { value: "card", label: "Credit Card", icon: CreditCard, color: "#7C3AED" },
  { value: "cheque", label: "Cheque", icon: ScrollText, color: "#B45309" },
  { value: "other", label: "Other", icon: MoreHorizontal, color: "#64748B" },
] as const satisfies readonly {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}[];

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS.map((m) => m.value) as [
  PaymentMethod,
  ...PaymentMethod[],
];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "cash";

export function paymentMethodLabel(value: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}
