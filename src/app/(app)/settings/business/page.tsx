import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessSettingsForm } from "@/features/business/components/business-settings-form";
import { getBusinessSettings, getCurrentBusiness, getLogoUrl } from "@/features/business/queries";
import { hasMoneyRecords } from "@/features/sales/queries";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.settings.business.title} · ${copy.brand.name}` };

export default async function BusinessSettingsPage() {
  const business = await getCurrentBusiness();
  if (!business) return null;
  if (!can(business.role, "business.manageSettings")) redirect("/settings/categories");
  const settings = await getBusinessSettings(business.id);
  if (!settings) return null;
  const [logoUrl, currencyLocked] = await Promise.all([
    getLogoUrl(settings.logoPath),
    hasMoneyRecords(business.id),
  ]);

  return (
    <BusinessSettingsForm settings={settings} logoUrl={logoUrl} currencyLocked={currencyLocked} />
  );
}
