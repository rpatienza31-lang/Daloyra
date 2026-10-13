import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { Button } from "@/components/ui/button";
import { getCurrentBusiness } from "@/features/business/queries";
import { PrintButton } from "@/features/reports/components/print-button";
import { ReportTable } from "@/features/reports/components/report-view";
import { buildReportView, reportPeriodLabel } from "@/features/reports/model";
import { runReport } from "@/features/reports/queries";
import {
  REPORTS,
  REPORT_PERIODS,
  isReportType,
  periodQuery,
  selectReportPeriod,
} from "@/features/reports/schema";
import { copy } from "@/lib/copy";
import { formatDate, periodRange, todayIn } from "@/lib/dates";
import { can } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: PageProps<"/reports/[type]">): Promise<Metadata> {
  const { type } = await params;
  const title = isReportType(type) ? copy.reports.types[type].title : copy.reports.title;
  return { title: `${title} · ${copy.brand.name}` };
}

export default async function ReportPage({ params, searchParams }: PageProps<"/reports/[type]">) {
  const { type } = await params;
  if (!isReportType(type)) notFound();
  const business = await getCurrentBusiness();
  if (!business) return null;
  const r = copy.reports;
  if (!can(business.role, "reports.view")) {
    return <PageHeader title={r.title} description={r.notAllowed} />;
  }

  const defaultPeriod = REPORTS[type].defaultPeriod;
  const period = selectReportPeriod(await searchParams, defaultPeriod, business.timezone);
  const report = await runReport(type, business.id, period);
  const view = buildReportView(report, period);
  const label = reportPeriodLabel(period);
  // Custom dates start from the period shown, or this month for "All dates".
  const month = periodRange("this_month", business.timezone);

  return (
    <>
      <Link
        href="/reports"
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline print:hidden"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {r.back}
      </Link>
      <PageHeader
        title={r.types[type].title}
        description={r.types[type].description}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button asChild variant="outline">
              <a href={`/reports/${type}/export?${periodQuery(period)}`} download>
                <Download aria-hidden />
                {r.download}
              </a>
            </Button>
            <PrintButton />
          </div>
        }
      />
      <div className="mb-6 flex flex-col gap-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase">{r.period(label)}</p>
        <div className="print:hidden">
          <PeriodFilter
            key={`${period.period}|${period.from}|${period.to}`}
            basePath={`/reports/${type}`}
            periods={REPORT_PERIODS}
            defaultPeriod={defaultPeriod}
            period={period.period}
            from={period.from ?? month.from}
            to={period.to ?? month.to}
            invalid={period.invalid}
          />
        </div>
        <p className="hidden text-xs text-muted-foreground print:block">
          {r.printedOn(formatDate(todayIn(business.timezone)))}
        </p>
      </div>
      <ReportTable view={view} currencyCode={business.currencyCode} />
    </>
  );
}
