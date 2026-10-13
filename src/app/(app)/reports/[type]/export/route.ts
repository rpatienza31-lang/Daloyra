import { getCurrentBusiness } from "@/features/business/queries";
import { buildReportView, reportCsv, reportPeriodLabel } from "@/features/reports/model";
import { runReport } from "@/features/reports/queries";
import { REPORTS, isReportType, selectReportPeriod } from "@/features/reports/schema";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

/** CSV download of one report, built from the same Postgres figures as the page. */
export async function GET(request: Request, { params }: RouteContext<"/reports/[type]/export">) {
  const { type } = await params;
  if (!isReportType(type)) return new Response("Not found", { status: 404 });
  const business = await getCurrentBusiness();
  if (!business) return new Response("Unauthorized", { status: 401 });
  if (!can(business.role, "reports.view")) return new Response("Forbidden", { status: 403 });

  const search = Object.fromEntries(new URL(request.url).searchParams);
  const period = selectReportPeriod(search, REPORTS[type].defaultPeriod, business.timezone);
  const report = await runReport(type, business.id, period);
  const csv = reportCsv(buildReportView(report, period), {
    business: business.name,
    title: copy.reports.types[type].title,
    period: reportPeriodLabel(period),
  });
  const dates = period.from && period.to ? `${period.from}-to-${period.to}` : "all-dates";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="daloyra-${type}-${dates}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
