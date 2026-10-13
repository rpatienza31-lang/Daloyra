import { PageHeader } from "@/components/layout/page-header";
import { SettingsTabs } from "@/components/layout/settings-tabs";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const business = await getCurrentBusiness();
  const t = copy.settings.tabs;
  const tabs = [
    can(business?.role, "business.manageSettings")
      ? { href: "/settings/business", label: t.business }
      : null,
    { href: "/settings/categories", label: t.categories },
    { href: "/settings/account", label: t.account },
    can(business?.role, "auditLog.view") ? { href: "/settings/activity", label: t.activity } : null,
  ].filter((tab) => tab !== null);

  return (
    <>
      <PageHeader title={copy.settings.title} />
      <SettingsTabs tabs={tabs} />
      <div className="mt-6">{children}</div>
    </>
  );
}
