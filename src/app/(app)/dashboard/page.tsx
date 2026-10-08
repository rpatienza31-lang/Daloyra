import type { Metadata } from "next";
import { FormMessage } from "@/components/forms/form-field";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `Dashboard · ${copy.brand.name}` };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const business = await getCurrentBusiness();
  const { notice } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      {notice === "logo_failed" ? (
        <FormMessage>{copy.onboarding.errors.logoFailed}</FormMessage>
      ) : null}
      <section className="rounded-card border border-border bg-card p-6 shadow-soft">
        <h1 className="text-2xl font-bold">{copy.app.dashboard.welcome(business?.name ?? "")}</h1>
        <p className="mt-2 text-muted-foreground">{copy.app.dashboard.ready}</p>
      </section>
    </div>
  );
}
