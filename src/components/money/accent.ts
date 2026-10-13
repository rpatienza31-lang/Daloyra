import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * What a figure is about, and its fixed color (globals.css): the same color always means
 * the same thing on cards, report rows and charts.
 */
export type Accent =
  "sales" | "purchases" | "expenses" | "profit" | "loss" | "cash" | "collect" | "in" | "out";

/** Full class names, so Tailwind keeps them. */
export const ACCENTS: Record<
  Accent,
  { chip: string; dot: string; band: string; icon: LucideIcon }
> = {
  sales: {
    chip: "bg-sales-tint text-sales-ink",
    dot: "bg-sales",
    band: "bg-sales-tint",
    icon: ShoppingCart,
  },
  purchases: {
    chip: "bg-purchases-tint text-purchases-ink",
    dot: "bg-purchases",
    band: "bg-purchases-tint",
    icon: Truck,
  },
  expenses: {
    chip: "bg-expenses-tint text-expenses-ink",
    dot: "bg-expenses",
    band: "bg-expenses-tint",
    icon: Receipt,
  },
  profit: {
    chip: "bg-profit-tint text-money-in",
    dot: "bg-money-in",
    band: "bg-profit-tint",
    icon: TrendingUp,
  },
  loss: {
    chip: "bg-loss-tint text-money-out",
    dot: "bg-money-out",
    band: "bg-loss-tint",
    icon: TrendingDown,
  },
  cash: { chip: "bg-cash-tint text-cash", dot: "bg-cash", band: "bg-cash-tint", icon: Wallet },
  collect: {
    chip: "bg-collect-tint text-collect",
    dot: "bg-collect",
    band: "bg-collect-tint",
    icon: HandCoins,
  },
  in: {
    chip: "bg-profit-tint text-money-in",
    dot: "bg-money-in",
    band: "bg-profit-tint",
    icon: ArrowDownLeft,
  },
  out: {
    chip: "bg-loss-tint text-money-out",
    dot: "bg-money-out",
    band: "bg-loss-tint",
    icon: ArrowUpRight,
  },
};
