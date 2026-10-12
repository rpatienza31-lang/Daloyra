import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, Receipt, ShoppingCart, UserPlus } from "lucide-react";
import { FormMessage } from "@/components/forms/form-field";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.app.dashboard.title} · ${copy.brand.name}` };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const business = await getCurrentBusiness();
  const { notice } = await searchParams;
  const t = copy.app.dashboard;

  return (
    <>
      {notice === "logo_failed" ? (
        <div className="mb-6">
          <FormMessage>{copy.onboarding.errors.logoFailed}</FormMessage>
        </div>
      ) : null}
      <PageHeader title={t.welcome(business?.name ?? "")} />
      {/* First-time dashboard (SPEC Section 9, flow 2). Sales and expenses arrive in Phases 3–4. */}
      <EmptyState
        icon={LayoutDashboard}
        title={t.title}
        body={t.emptyBody}
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" disabled title={copy.nav.comingSoon}>
              <ShoppingCart aria-hidden />
              {t.recordSale}
            </Button>
            <Button size="lg" variant="outline" disabled title={copy.nav.comingSoon}>
              <Receipt aria-hidden />
              {t.recordExpense}
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
