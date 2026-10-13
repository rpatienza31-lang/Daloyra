import { InfoTip } from "@/components/ui/info-tip";
import { copy } from "@/lib/copy";
import { compareMoney, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ACCENTS, type Accent } from "./accent";

/**
 * One figure on a card, with a colored icon saying what it is about. With `signed`, a
 * negative value is red and carries a minus sign and the word "loss", so the meaning never
 * rests on color alone (SPEC Section 11); a positive profit is green.
 * `highlight` tints the whole card: for the one figure that matters most in a group.
 */
export function StatCard({
  label,
  amount,
  currencyCode,
  accent,
  info,
  signed,
  highlight,
  testId,
}: {
  label: string;
  amount: string;
  currencyCode: string;
  accent: Accent;
  info?: string;
  signed?: boolean;
  highlight?: boolean;
  testId?: string;
}) {
  const sign = compareMoney(amount, "0");
  const negative = signed && sign < 0;
  // A profit figure turns into a loss figure (icon and color) below zero.
  const effective: Accent = accent === "profit" && negative ? "loss" : accent;
  const a = ACCENTS[effective];
  const Icon = a.icon;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-card border p-4 shadow-soft sm:p-5 print:shadow-none",
        highlight ? cn(a.band, "border-transparent") : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            highlight ? "bg-card/80" : a.chip,
            highlight && a.chip.split(" ").find((c) => c.startsWith("text-")),
          )}
        >
          <Icon aria-hidden className="size-[18px]" />
        </span>
        <p className="min-w-0 flex-1 text-xs leading-tight font-medium text-muted-foreground sm:text-sm">
          {label}
        </p>
        {info ? <InfoTip label={copy.app.dashboard.info.about(label)}>{info}</InfoTip> : null}
      </div>
      <p
        data-testid={testId}
        className={cn(
          "font-heading text-xl font-bold tracking-tight [overflow-wrap:anywhere] amount sm:text-2xl lg:text-[28px]",
          negative && "text-money-out",
          accent === "profit" && sign > 0 && "text-money-in",
        )}
      >
        {formatMoney(amount, currencyCode)}
        {negative ? (
          <span className="ml-1.5 font-sans text-xs font-medium tracking-normal sm:text-sm">
            {copy.app.dashboard.profitLoss}
          </span>
        ) : null}
      </p>
    </div>
  );
}
