import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import { Toaster } from "@/components/ui/sonner";
import { isPlatformAdmin } from "@/features/billing/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { requireUserId } from "@/lib/auth";
import { copy } from "@/lib/copy";

/**
 * Platform admin area (Phase 8). Only users listed in public.platform_admins get past this
 * check, and every admin function checks it again in the database. Others see "not found".
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  if (!(await isPlatformAdmin())) notFound();
  const business = await getCurrentBusiness();
  const t = copy.admin;
  const link =
    "inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-8">
          <Link href="/admin" className="flex items-center gap-2.5 font-heading text-lg font-bold">
            <span className="flex size-8 items-center justify-center rounded-[10px] bg-foreground text-background">
              <ShieldCheck aria-hidden className="size-5" />
            </span>
            {copy.brand.name} {t.title}
          </Link>
          <nav aria-label={t.title} className="flex flex-wrap items-center gap-1">
            <Link href="/admin" className={link}>
              {t.businesses}
            </Link>
            <Link href="/admin/log" className={link}>
              {t.log}
            </Link>
            {business ? (
              <Link href="/dashboard" className={link}>
                {t.backToApp}
              </Link>
            ) : null}
            <div className="w-36">
              <LogoutButton />
            </div>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      <Toaster />
    </div>
  );
}
