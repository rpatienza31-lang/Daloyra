import { InfoTip } from "@/components/ui/info-tip";
import { copy } from "@/lib/copy";
import { compareMoney, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * One dashboard figure. With `signed`, a negative value is shown red with a minus sign
 * and the word "loss", so the meaning never rests on color alone (SPEC Section 11).
 */
export function StatCard({
  label,
  amount,
  currencyCode,
  info,
  signed,
  tone,
  testId,
}: {
  label: string;
  amount: string;
  currencyCode: string;
  info?: string;
  signed?: boolean;
  tone?: "in" | "out";
  testId?: string;
}) {
  const negative = signed && compareMoney(amount, "0") < 0;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        {info ? <InfoTip label={copy.app.dashboard.info.about(label)}>{info}</InfoTip> : null}
      </div>
      <p
        data-testid={testId}
        className={cn(
          "text-lg font-semibold [overflow-wrap:anywhere] amount sm:text-2xl lg:text-[28px]",
          negative && "text-money-out",
          signed && !negative && compareMoney(amount, "0") > 0 && "text-money-in",
          tone === "in" && "text-money-in",
          tone === "out" && "text-money-out",
        )}
      >
        {formatMoney(amount, currencyCode)}
        {negative ? (
          <span className="ml-1.5 text-xs font-medium sm:text-sm">
            {copy.app.dashboard.profitLoss}
          </span>
        ) : null}
      </p>
    </div>
  );
}
