import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentBusiness } from "@/features/business/queries";
import { REPORTS, REPORT_TYPES } from "@/features/reports/schema";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.reports.title} · ${copy.brand.name}` };

const GROUPS = ["moneyIn", "moneyOut", "summaries"] as const;

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
              className="text-sm font-semibold text-muted-foreground uppercase"
            >
              {r.groups[group]}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {REPORT_TYPES.filter((type) => REPORTS[type].group === group).map((type) => (
                <li key={type}>
                  <Link
                    href={`/reports/${type}`}
                    className="flex h-full min-h-11 items-center gap-3 rounded-card border border-border bg-card p-5 shadow-soft hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.types[type].title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {r.types[type].description}
                      </p>
                    </div>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
