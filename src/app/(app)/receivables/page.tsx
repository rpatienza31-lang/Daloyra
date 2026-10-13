import type { Metadata } from "next";
import { HandCoins } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReceivablesList } from "@/features/sales/components/receivables-list";
import { getAmountToCollect, listReceivables } from "@/features/sales/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: `${copy.receivables.title} · ${copy.brand.name}` };

export default async function ReceivablesPage() {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const [sales, total] = await Promise.all([
    listReceivables(business.id),
    getAmountToCollect(business.id),
  ]);
  const r = copy.receivables;

  return (
    <>
      <PageHeader title={r.title} description={r.subtitle} />
      {sales.length === 0 ? (
        <EmptyState icon={HandCoins} title={r.emptyTitle} body={r.emptyBody} />
      ) : (
        <>
          <section className="mb-6 rounded-card border border-border bg-card p-5 shadow-soft">
            <h2 className="text-sm font-medium text-muted-foreground">{r.total}</h2>
            <p className="mt-1 text-[28px] font-semibold amount">
              {formatMoney(total, business.currencyCode)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{r.totalHelp}</p>
          </section>
          <ReceivablesList sales={sales} currencyCode={business.currencyCode} />
        </>
      )}
    </>
  );
}
