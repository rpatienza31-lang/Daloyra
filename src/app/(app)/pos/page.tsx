import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PosScreen } from "@/features/sales/components/pos-screen";
import { listCustomerOptions } from "@/features/sales/queries";
import { listProductOptions } from "@/features/products/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { todayIn } from "@/lib/dates";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.pos.title} · ${copy.brand.name}` };

export default async function PosPage() {
  const business = await getCurrentBusiness();
  if (!business) return null;
  if (!can(business.role, "money.record")) redirect("/sales");
  const [products, customers] = await Promise.all([
    listProductOptions(business.id),
    listCustomerOptions(business.id),
  ]);

  return (
    <>
      <PageHeader title={copy.pos.title} description={copy.pos.subtitle} />
      <PosScreen
        products={products}
        customers={customers}
        currencyCode={business.currencyCode}
        today={todayIn(business.timezone)}
        canAddCustomer={can(business.role, "people.add")}
      />
    </>
  );
}
