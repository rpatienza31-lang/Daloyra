import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { ActivityFilter, ActivityList } from "@/features/activity/components/activity-list";
import { ACTIVITY_PAGE, listActivity } from "@/features/activity/queries";
import { activityFiltersSchema } from "@/features/activity/schema";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

export const metadata: Metadata = {
  title: `${copy.settings.activity.title} · ${copy.brand.name}`,
};

/** /settings/activity: the audit log for owners (SPEC Sections 8 and 14). */
export default async function ActivityPage({ searchParams }: PageProps<"/settings/activity">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const t = copy.settings.activity;
  if (!can(business.role, "auditLog.view")) {
    return <p className="text-muted-foreground">{copy.common.notAllowed}</p>;
  }
  const params = await searchParams;
  const filters = activityFiltersSchema.parse({
    kind: typeof params.kind === "string" ? params.kind : undefined,
    before: typeof params.before === "string" ? params.before : undefined,
    beforeId: typeof params.id === "string" ? params.id : undefined,
  });
  const entries = await listActivity(business.id, filters);
  const last = entries.at(-1);
  const olderHref =
    entries.length === ACTIVITY_PAGE && last
      ? `/settings/activity?${new URLSearchParams({
          ...(filters.kind ? { kind: filters.kind } : {}),
          before: last.createdAt,
          id: last.id,
        }).toString()}`
      : null;

  return (
    <section aria-labelledby="activity-title">
      <h2 id="activity-title" className="text-lg font-semibold">
        {t.title}
      </h2>
      <p className="mt-1 mb-4 max-w-2xl text-sm text-muted-foreground">{t.subtitle}</p>
      <ActivityFilter kind={filters.kind} />
      {entries.length === 0 ? (
        <EmptyState
          icon={History}
          title={t.title}
          body={filters.kind ? t.emptyFiltered : t.empty}
        />
      ) : (
        <ActivityList
          entries={entries}
          currencyCode={business.currencyCode}
          timezone={business.timezone}
        />
      )}
      <div className="mt-4 flex gap-2">
        {filters.before ? (
          <Button asChild variant="ghost">
            <Link
              href={filters.kind ? `/settings/activity?kind=${filters.kind}` : "/settings/activity"}
            >
              {t.newest}
            </Link>
          </Button>
        ) : null}
        {olderHref ? (
          <Button asChild variant="outline">
            <Link href={olderHref}>{t.older}</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
