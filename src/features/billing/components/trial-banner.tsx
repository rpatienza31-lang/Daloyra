import Link from "next/link";
import { Sparkles } from "lucide-react";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";

/** Shown on every page during the free trial (SPEC 14, Phase 8). */
export function TrialBanner({ daysLeft, price }: { daysLeft: number; price: string }) {
  const t = copy.billing;
  return (
    <div className="border-b border-border bg-secondary print:hidden" role="status">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm md:px-8">
        <p className="inline-flex items-center gap-2 font-medium text-secondary-foreground">
          <Sparkles aria-hidden className="size-4" />
          {t.trialBanner(daysLeft)}
        </p>
        <Link
          href="/settings/plan"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline sm:min-h-0"
        >
          {t.trialBannerCta(formatMoney(price, "PHP"))}
        </Link>
      </div>
    </div>
  );
}
