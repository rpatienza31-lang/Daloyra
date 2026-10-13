"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Menu, Receipt, ShoppingCart } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { copy } from "@/lib/copy";
import { isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NavGroups } from "./nav-groups";
import { NewSheet } from "./new-sheet";

/** Phone navigation: Home · Sales · + · Expenses · More (SPEC Section 12). */
export function BottomBar({ footer }: { footer: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <nav
      aria-label={copy.nav.mainNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        <li>
          <BarLink
            href="/dashboard"
            label={copy.nav.home}
            icon={House}
            active={isActive(pathname, "/dashboard")}
          />
        </li>
        <li>
          <BarLink
            href="/sales"
            label={copy.nav.sales}
            icon={ShoppingCart}
            active={isActive(pathname, "/sales")}
          />
        </li>
        <li className="flex justify-center">
          <NewSheet variant="fab" />
        </li>
        <li>
          <BarLink
            href="/expenses"
            label={copy.nav.expenses}
            icon={Receipt}
            active={isActive(pathname, "/expenses")}
          />
        </li>
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(barItem, "w-full text-muted-foreground")}
            >
              <Menu aria-hidden className="size-6" />
              {copy.nav.more}
            </button>
            <SheetContent side="bottom" title={copy.nav.menu}>
              <NavGroups onNavigate={() => setMoreOpen(false)} />
              <div className="mt-5 border-t border-border pt-4">{footer}</div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

const barItem =
  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-control text-xs font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

function BarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href?: string;
  label: string;
  icon: typeof House;
  active?: boolean;
}) {
  if (!href) {
    return (
      <span className={cn(barItem, "text-text-muted")} aria-disabled title={copy.nav.comingSoon}>
        <Icon aria-hidden className="size-6" />
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(barItem, active ? "text-primary" : "text-muted-foreground")}
    >
      <Icon aria-hidden className="size-6" />
      {label}
    </Link>
  );
}
