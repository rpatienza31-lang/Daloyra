"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/lib/copy";
import { isActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** A sidebar or "More" sheet entry. Pages not built yet show a "Soon" badge. */
export function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const base =
    "flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors";

  if (!item.available) {
    return (
      <span className={cn(base, "text-text-muted")} aria-disabled>
        <Icon aria-hidden className="size-5" />
        <span className="flex-1">{item.label}</span>
        <Badge variant="muted">{copy.nav.soon}</Badge>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        base,
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        "relative",
        active
          ? "bg-secondary font-semibold text-primary before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon aria-hidden className={cn("size-5", active ? "text-primary" : "text-text-muted")} />
      {item.label}
    </Link>
  );
}
