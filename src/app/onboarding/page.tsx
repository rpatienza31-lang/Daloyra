import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import { OnboardingWizard } from "@/features/business/components/onboarding-wizard";
import { getCurrentBusiness, getProfileName } from "@/features/business/queries";
import { requireUserId } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: `${copy.onboarding.title} · ${copy.brand.name}` };

export default async function OnboardingPage() {
  await requireUserId();
  if (await getCurrentBusiness()) redirect(routes.dashboard);
  const profileName = await getProfileName();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 md:py-12">
      <div className="flex items-center justify-between">
        <p className="font-heading text-lg font-bold text-primary">{copy.brand.name}</p>
        <LogoutButton />
      </div>
      <h1 className="mt-6 text-2xl font-bold">{copy.onboarding.title}</h1>
      <div className="mt-6 rounded-card border border-border bg-card p-5 shadow-soft sm:p-6">
        <OnboardingWizard defaultOwnerName={profileName ?? undefined} />
      </div>
    </main>
  );
}
