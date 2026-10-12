import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  HandCoins,
  House,
  ListChecks,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { copy } from "@/lib/copy";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** False until the phase that builds the page; shown as "Soon". */
  available: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const n = copy.nav;

/** Sidebar groups (SPEC Section 12). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: n.groups.overview,
    items: [{ href: "/dashboard", label: n.dashboard, icon: House, available: true }],
  },
  {
    label: n.groups.moneyIn,
    items: [
      { href: "/sales", label: n.sales, icon: ShoppingCart, available: false },
      { href: "/receivables", label: n.toCollect, icon: HandCoins, available: false },
    ],
  },
  {
    label: n.groups.moneyOut,
    items: [
      { href: "/purchases", label: n.purchases, icon: Truck, available: false },
      { href: "/expenses", label: n.expenses, icon: Receipt, available: false },
      { href: "/payables", label: n.toPay, icon: Wallet, available: false },
    ],
  },
  {
    label: n.groups.people,
    items: [
      { href: "/customers", label: n.customers, icon: UserRound, available: true },
      { href: "/suppliers", label: n.suppliers, icon: Package, available: true },
    ],
  },
  {
    label: n.groups.insights,
    items: [
      { href: "/transactions", label: n.transactions, icon: ListChecks, available: false },
      { href: "/reports", label: n.reports, icon: BarChart3, available: false },
    ],
  },
  {
    label: n.groups.settings,
    items: [{ href: "/settings", label: n.settings, icon: Settings, available: true }],
  },
];

export interface NewItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Null until the phase that builds the form. */
  href: string | null;
}

/** The "+ New" sheet (SPEC Section 12). */
export const NEW_MONEY_ITEMS: NewItem[] = [
  { key: "sale", label: n.sale, icon: ShoppingCart, href: null },
  { key: "expense", label: n.expense, icon: Receipt, href: null },
  { key: "purchase", label: n.purchase, icon: Truck, href: null },
  { key: "payment-received", label: n.paymentReceived, icon: ArrowDownLeft, href: null },
  { key: "payment-made", label: n.paymentMade, icon: ArrowUpRight, href: null },
  { key: "other-money", label: n.otherMoney, icon: ArrowLeftRight, href: null },
];

export const NEW_PEOPLE_ITEMS: NewItem[] = [
  { key: "customer", label: n.customer, icon: UserRound, href: "/customers?new=1" },
  { key: "supplier", label: n.supplier, icon: Package, href: "/suppliers?new=1" },
];

/** True when `pathname` is the item's page or a page below it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
