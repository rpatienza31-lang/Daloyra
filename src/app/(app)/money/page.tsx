import type { Metadata } from "next";
import { OtherMoneyView } from "@/features/other-money/components/other-money-view";
import { listEntries } from "@/features/other-money/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { todayIn } from "@/lib/dates";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.otherMoney.title} · ${copy.brand.name}` };

export default async function OtherMoneyPage({ searchParams }: PageProps<"/money">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const entries = await listEntries(business.id);

  return (
    <OtherMoneyView
      entries={entries}
      currencyCode={business.currencyCode}
      today={todayIn(business.timezone)}
      canRecord={can(business.role, "money.record")}
      canEdit={can(business.role, "money.edit")}
      canVoid={can(business.role, "money.void")}
      startAdding={params.new === "1"}
    />
  );
}
