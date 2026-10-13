import type { Metadata } from "next";
import { PurchasesList } from "@/features/purchases/components/purchases-list";
import { hasAnyPurchases, listPurchases, type PurchaseFilter } from "@/features/purchases/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { PAYMENT_METHOD_VALUES, type PaymentMethod } from "@/lib/payment-methods";

export const metadata: Metadata = { title: `${copy.purchases.title} · ${copy.brand.name}` };

const FILTERS: PurchaseFilter[] = ["all", "to_pay", "paid", "voided"];

export default async function PurchasesPage({ searchParams }: PageProps<"/purchases">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const filter = FILTERS.find((f) => f === params.status) ?? "all";
  const method = PAYMENT_METHOD_VALUES.find((m) => m === params.method) ?? null;

  const [purchases, anyPurchases] = await Promise.all([
    listPurchases(business.id, filter, method as PaymentMethod | null),
    hasAnyPurchases(business.id),
  ]);

  return (
    <PurchasesList
      purchases={purchases}
      filter={filter}
      method={method ?? ""}
      currencyCode={business.currencyCode}
      hasAnyPurchases={anyPurchases}
    />
  );
}
