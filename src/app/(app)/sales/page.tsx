import type { Metadata } from "next";
import { SalesList } from "@/features/sales/components/sales-list";
import { hasAnySales, listSales, type SaleFilter } from "@/features/sales/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { PAYMENT_METHOD_VALUES, type PaymentMethod } from "@/lib/payment-methods";

export const metadata: Metadata = { title: `${copy.sales.title} · ${copy.brand.name}` };

const FILTERS: SaleFilter[] = ["all", "to_collect", "paid", "voided"];

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const filter = FILTERS.find((f) => f === params.status) ?? "all";
  const method = PAYMENT_METHOD_VALUES.find((m) => m === params.method) ?? null;

  const [sales, anySales] = await Promise.all([
    listSales(business.id, filter, method as PaymentMethod | null),
    hasAnySales(business.id),
  ]);

  return (
    <SalesList
      sales={sales}
      filter={filter}
      method={method ?? ""}
      currencyCode={business.currencyCode}
      hasAnySales={anySales}
    />
  );
}
