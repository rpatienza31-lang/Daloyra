import Link from "next/link";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";
import { formatWhen } from "../format";
import type { AdminAction } from "../queries";

const t = copy.admin;

function detailText(a: AdminAction): string {
  const d = a.details;
  const parts: string[] = [];
  if (a.action === "activate_plan" && typeof d.price === "string")
    parts.push(`Lifetime · ${formatMoney(d.price, "PHP")}`);
  if (a.action === "extend_trial" && typeof d.days === "number")
    parts.push(t.actionDetails.days(d.days));
  if (typeof d.note === "string") parts.push(t.actionDetails.reference(d.note));
  if (typeof d.reason === "string") parts.push(t.actionDetails.reason(d.reason));
  return parts.join(" · ");
}

/** The admin log: who did what to which business, newest first. Read-only. */
export function ActionLog({
  actions,
  showBusiness = true,
}: {
  actions: AdminAction[];
  showBusiness?: boolean;
}) {
  if (actions.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        {t.emptyLog}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-soft">
      {actions.map((a) => (
        <li key={`${a.createdAt}-${a.action}`} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
          <p>
            <span className="font-semibold">{t.actions[a.action]}</span>
            {showBusiness ? (
              <>
                {" · "}
                {a.businessId ? (
                  <Link
                    href={`/admin/businesses/${a.businessId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {a.businessName}
                  </Link>
                ) : (
                  a.businessName
                )}
              </>
            ) : null}
          </p>
          {detailText(a) ? <p className="text-muted-foreground">{detailText(a)}</p> : null}
          <p className="text-xs text-muted-foreground">
            {formatWhen(a.createdAt, true)} · {a.adminEmail}
          </p>
        </li>
      ))}
    </ul>
  );
}
