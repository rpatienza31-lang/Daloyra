import { Lock } from "lucide-react";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";
import { PaySteps } from "./pay-steps";

/** The whole app is replaced by this once the trial has ended without payment (owner decision). */
export function TrialEnded({ businessName, price }: { businessName: string; price: string }) {
  const t = copy.billing;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 rounded-card border border-border bg-card p-6 shadow-soft sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Lock aria-hidden className="size-6" />
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.endedTitle}</h1>
        <p className="mt-2 text-muted-foreground">{t.endedBody(formatMoney(price, "PHP"))}</p>
      </div>
      <PaySteps businessName={businessName} />
    </div>
  );
}
