import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessSettingsForm } from "@/features/business/components/business-settings-form";
import { getBusinessSettings, getCurrentBusiness, getLogoUrl } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.settings.business.title} · ${copy.brand.name}` };

export default async function BusinessSettingsPage() {
  const business = await getCurrentBusiness();
  if (!business) return null;
  if (!can(business.role, "business.manageSettings")) redirect("/settings/categories");
  const settings = await getBusinessSettings(business.id);
  if (!settings) return null;
  const logoUrl = await getLogoUrl(settings.logoPath);

  return <BusinessSettingsForm settings={settings} logoUrl={logoUrl} />;
}
