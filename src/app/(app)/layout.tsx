import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Store } from "lucide-react";
import { BottomBar } from "@/components/layout/bottom-bar";
import { LogoutButton } from "@/components/layout/logout-button";
import { NavGroups } from "@/components/layout/nav-groups";
import { NewSheet } from "@/components/layout/new-sheet";
import { Toaster } from "@/components/ui/sonner";
import { TrialBanner } from "@/features/billing/components/trial-banner";
import { TrialEnded } from "@/features/billing/components/trial-ended";
import { getAccess, isPlatformAdmin } from "@/features/billing/queries";
import { getCurrentBusiness, getLogoUrl } from "@/features/business/queries";
import { requireUserId } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";

/**
 * Protected app shell: sidebar on desktop, bottom bar on phones (SPEC Section 12).
 * Every page below needs a signed-in user with a business.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  const business = await getCurrentBusiness();
  if (!business) redirect((await isPlatformAdmin()) ? "/admin" : routes.onboarding);
  const [logoUrl, access, admin] = await Promise.all([
    getLogoUrl(business.logoPath),
    getAccess(business.id),
    isPlatformAdmin(),
  ]);
  const suspended = business.status === "suspended";
  // Owner decision (Phase 8): once the trial ends without payment, the app is fully blocked.
  const trialEnded = !suspended && access?.access === "trial_ended";
  const blocked = suspended || trialEnded;

  const brand = (
    <Link
      href={routes.dashboard}
      className="flex min-w-0 items-center gap-3 rounded-control focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-muted">
        {logoUrl ? (
          // Signed URL from private storage; next/image would need remote config per project.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-full object-contain" />
        ) : (
          <Store aria-hidden className="size-5 text-muted-foreground" />
        )}
      </span>
      <span className="truncate font-heading font-semibold">{business.name}</span>
    </Link>
  );

  return (
    <div className="flex min-h-full flex-1">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-card md:flex print:hidden">
        <div className="flex h-16 items-center px-4">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-sales font-heading text-base font-bold text-white shadow-soft"
            >
              D
            </span>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              {copy.brand.name}
            </span>
          </span>
        </div>
        <nav aria-label={copy.nav.mainNav} className="flex-1 overflow-y-auto px-3 py-2">
          {blocked ? null : <NavGroups />}
          {admin ? (
            <Link
              href="/admin"
              className="mt-5 flex min-h-11 items-center gap-3 rounded-control border border-dashed border-border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ShieldCheck aria-hidden className="size-5" />
              {copy.admin.adminLink}
            </Link>
          ) : null}
        </nav>
        <div className="border-t border-border p-3">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-60 print:pl-0">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur print:static print:border-0 print:bg-transparent">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-8 print:max-w-none print:px-0">
            {brand}
            {blocked ? null : (
              <div className="hidden md:block print:hidden">
                <NewSheet variant="button" />
              </div>
            )}
          </div>
        </header>
        {!blocked && access?.access === "trial" ? (
          <TrialBanner daysLeft={access.daysLeft ?? 0} price={access.price} />
        ) : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-10 print:max-w-none print:p-0">
          {suspended ? (
            <div role="alert" className="rounded-card border border-destructive/30 bg-card p-6">
              <h1 className="text-xl font-bold">{copy.app.suspended.title}</h1>
              <p className="mt-2 text-muted-foreground">{copy.app.suspended.body}</p>
            </div>
          ) : trialEnded ? (
            <TrialEnded businessName={business.name} price={access?.price ?? "599.00"} />
          ) : (
            children
          )}
          {blocked ? (
            <div className="mx-auto mt-6 max-w-lg md:hidden">
              <LogoutButton />
            </div>
          ) : null}
        </main>
      </div>

      <div className="print:hidden">{blocked ? null : <BottomBar footer={<LogoutButton />} />}</div>
      <Toaster />
    </div>
  );
}
