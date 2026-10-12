import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/features/business/queries";
import { can } from "@/lib/permissions";

export default async function SettingsPage() {
  const business = await getCurrentBusiness();
  redirect(
    can(business?.role, "business.manageSettings") ? "/settings/business" : "/settings/categories",
  );
}
