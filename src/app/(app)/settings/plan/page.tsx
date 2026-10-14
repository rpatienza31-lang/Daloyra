import type { Metadata } from "next";
import { BadgeCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PaySteps } from "@/features/billing/components/pay-steps";
import { getAccess } from "@/features/billing/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.billing.planTab} · ${copy.brand.name}` };

/** /settings/plan: the owner's plan and how to pay the one-time fee (Phase 8). */
export default async function PlanPage() {
  const business = await getCurrentBusiness();
  if (!business) return null;
  if (!can(business.role, "subscription.view")) {
    return <p className="text-muted-foreground">{copy.common.notAllowed}</p>;
  }
  const access = await getAccess(business.id);
  const t = copy.billing;
  const price = formatMoney(access?.price ?? "599.00", "PHP");
  const paid = access?.access === "paid";
  const trialDate = access?.trialEndsAt
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: business.timezone }).format(
        new Date(access.trialEndsAt),
      )
    : null;

  return (
    <section aria-labelledby="plan-title" className="flex max-w-2xl flex-col gap-4">
      <h2 id="plan-title" className="text-lg font-semibold">
        {t.planTitle}
      </h2>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          {paid ? (
            <Badge variant="success">{t.statusPaid}</Badge>
          ) : access?.access === "trial" ? (
            <Badge variant="warning">{t.statusTrial(access.daysLeft ?? 0)}</Badge>
          ) : access?.access === "suspended" ? (
            <Badge variant="danger">{t.statusSuspended}</Badge>
          ) : (
            <Badge variant="danger">{t.statusEnded}</Badge>
          )}
          {!paid && trialDate ? (
            <span className="text-sm text-muted-foreground">{t.trialEnds(trialDate)}</span>
          ) : null}
        </div>
        {paid ? <p className="text-sm">{t.paidThanks}</p> : null}
      </div>

      {paid ? null : (
        <div className="flex flex-col gap-5 rounded-card border border-primary/30 bg-card p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <Sparkles aria-hidden className="size-5" />
            </span>
            <div>
              <p className="font-semibold">{t.lifetimeTitle}</p>
              <p className="mt-0.5 font-heading text-2xl font-bold tracking-tight amount">
                {price}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t.lifetimeBody(price)}</p>
            </div>
          </div>
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
              <BadgeCheck aria-hidden className="size-4 text-primary" />
              {t.howToPay}
            </p>
            <PaySteps businessName={business.name} />
          </div>
        </div>
      )}
    </section>
  );
}
