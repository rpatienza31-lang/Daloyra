import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PayablesList } from "@/features/purchases/components/payables-list";
import { getAmountToPay, listPayables } from "@/features/purchases/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: `${copy.payables.title} · ${copy.brand.name}` };

export default async function PayablesPage() {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const [purchases, total] = await Promise.all([
    listPayables(business.id),
    getAmountToPay(business.id),
  ]);
  const r = copy.payables;

  return (
    <>
      <PageHeader title={r.title} description={r.subtitle} />
      {purchases.length === 0 ? (
        <EmptyState icon={Wallet} title={r.emptyTitle} body={r.emptyBody} />
      ) : (
        <>
          <section className="mb-6 rounded-card border border-border bg-card p-5 shadow-soft">
            <h2 className="text-sm font-medium text-muted-foreground">{r.total}</h2>
            <p className="mt-1 text-[28px] font-semibold amount">
              {formatMoney(total, business.currencyCode)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{r.totalHelp}</p>
          </section>
          <PayablesList purchases={purchases} currencyCode={business.currencyCode} />
        </>
      )}
    </>
  );
}
