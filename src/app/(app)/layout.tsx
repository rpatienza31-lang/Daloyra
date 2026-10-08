import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import { getCurrentBusiness, getLogoUrl } from "@/features/business/queries";
import { requireUserId } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";

/**
 * Protected area. Every page below needs a signed-in user with a business.
 * The full navigation shell arrives in Phase 2.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  const business = await getCurrentBusiness();
  if (!business) redirect(routes.onboarding);
  const logoUrl = await getLogoUrl(business.logoPath);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-muted">
              {logoUrl ? (
                // Signed URL from private storage; next/image would need remote config per project.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="size-full object-contain" />
              ) : (
                <Store aria-hidden className="size-5 text-muted-foreground" />
              )}
            </div>
            <p className="truncate font-heading font-semibold">{business.name}</p>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">
        {business.status === "suspended" ? (
          <div role="alert" className="rounded-card border border-destructive/30 bg-card p-6">
            <h1 className="text-xl font-bold">{copy.app.suspended.title}</h1>
            <p className="mt-2 text-muted-foreground">{copy.app.suspended.body}</p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
