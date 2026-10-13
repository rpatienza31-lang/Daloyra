import type { Metadata } from "next";
import { OtherMoneyView } from "@/features/other-money/components/other-money-view";
import { getEntry, listEntries } from "@/features/other-money/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { todayIn } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: `${copy.otherMoney.title} · ${copy.brand.name}` };

export default async function OtherMoneyPage({ searchParams }: PageProps<"/money">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const openId = typeof params.open === "string" && isUuid(params.open) ? params.open : null;
  const [entries, opened] = await Promise.all([
    listEntries(business.id),
    openId ? getEntry(business.id, openId) : null,
  ]);

  return (
    <OtherMoneyView
      entries={entries}
      currencyCode={business.currencyCode}
      today={todayIn(business.timezone)}
      canRecord={can(business.role, "money.record")}
      canEdit={can(business.role, "money.edit")}
      canVoid={can(business.role, "money.void")}
      startAdding={params.new === "1"}
      opened={opened}
    />
  );
}
