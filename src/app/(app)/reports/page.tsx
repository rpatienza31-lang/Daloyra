import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  CreditCard,
  HandCoins,
  LineChart,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Building2,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { ACCENTS, type Accent } from "@/components/money/accent";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentBusiness } from "@/features/business/queries";
import { REPORTS, REPORT_TYPES, type ReportType } from "@/features/reports/schema";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: `${copy.reports.title} · ${copy.brand.name}` };

const GROUPS = ["moneyIn", "moneyOut", "summaries"] as const;

/** Each report's icon, in the color of what it is about. */
const LOOK: Record<ReportType, { icon: LucideIcon; accent: Accent }> = {
  sales: { icon: ShoppingCart, accent: "sales" },
  "sales-by-customer": { icon: Users, accent: "sales" },
  "to-collect": { icon: HandCoins, accent: "collect" },
  purchases: { icon: Truck, accent: "purchases" },
  "purchases-by-supplier": { icon: Building2, accent: "purchases" },
  expenses: { icon: Receipt, accent: "expenses" },
  "to-pay": { icon: CalendarClock, accent: "purchases" },
  "profit-and-loss": { icon: LineChart, accent: "profit" },
  "cash-flow": { icon: Wallet, accent: "cash" },
  "payment-methods": { icon: CreditCard, accent: "in" },
};

export default async function ReportsPage() {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const r = copy.reports;
  if (!can(business.role, "reports.view")) {
    return <PageHeader title={r.title} description={r.notAllowed} />;
  }

  return (
    <>
      <PageHeader title={r.title} description={r.subtitle} />
      <div className="flex flex-col gap-8">
        {GROUPS.map((group) => (
          <section key={group} aria-labelledby={`group-${group}`} className="flex flex-col gap-3">
            <h2
              id={`group-${group}`}
              className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              {r.groups[group]}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {REPORT_TYPES.filter((type) => REPORTS[type].group === group).map((type) => {
                const Icon = LOOK[type].icon;
                return (
                  <li key={type}>
                    <Link
                      href={`/reports/${type}`}
                      className="group flex h-full min-h-11 items-start gap-4 rounded-card border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-xl",
                          ACCENTS[LOOK[type].accent].chip,
                        )}
                      >
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{r.types[type].title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {r.types[type].description}
                        </p>
                      </div>
                      <ChevronRight
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
