import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL, copy } from "@/lib/copy";

const t = copy.billing;

/** How to pay the one-time fee: email us, get GCash/bank details, we activate. */
export function PaySteps({ businessName }: { businessName: string }) {
  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t.emailSubject(businessName))}`;
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2 text-left text-sm">
        {t.steps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <Button asChild size="lg">
          <a href={href}>
            <Mail aria-hidden />
            {t.emailUs}
          </a>
        </Button>
        <span className="text-sm font-medium text-muted-foreground">{SUPPORT_EMAIL}</span>
      </div>
    </div>
  );
}
