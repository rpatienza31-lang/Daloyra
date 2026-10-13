import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, Receipt, ShoppingCart, UserPlus } from "lucide-react";
import { FormMessage } from "@/components/forms/form-field";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentBusiness, hasMoneyRecords } from "@/features/business/queries";
import { DashboardView, StaffDashboard } from "@/features/dashboard/components/dashboard-view";
import { selectPeriod } from "@/features/dashboard/schema";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.app.dashboard.title} · ${copy.brand.name}` };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const t = copy.app.dashboard;
  const notice =
    params.notice === "logo_failed" ? (
      <div className="mb-6">
        <FormMessage>{copy.onboarding.errors.logoFailed}</FormMessage>
      </div>
    ) : null;

  if (await hasMoneyRecords(business.id)) {
    return (
      <>
        {notice}
        {can(business.role, "dashboard.viewTotals") ? (
          <DashboardView business={business} selected={selectPeriod(params, business.timezone)} />
        ) : (
          <StaffDashboard business={business} />
        )}
      </>
    );
  }

  return (
    <>
      {notice}
      <PageHeader title={t.welcome(business.name)} />
      {/* First-time dashboard (SPEC Section 9, flow 2). */}
      <EmptyState
        icon={LayoutDashboard}
        title={t.title}
        body={t.emptyBody}
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sales/new">
                <ShoppingCart aria-hidden />
                {t.recordSale}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/expenses?new=1">
                <Receipt aria-hidden />
                {t.recordExpense}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/customers?new=1">
                <UserPlus aria-hidden />
                {t.addCustomer}
              </Link>
            </Button>
          </div>
        }
      />
    </>
  );
}
