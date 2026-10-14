import type { Metadata } from "next";
import { ProductsList } from "@/features/products/components/products-list";
import { listProducts } from "@/features/products/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.products.title} · ${copy.brand.name}` };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const showArchived = params.show === "archived";
  const products = await listProducts(business.id, showArchived);

  return (
    <ProductsList
      products={products}
      showArchived={showArchived}
      canManage={can(business.role, "products.manage")}
      currencyCode={business.currencyCode}
      startAdding={params.new === "1"}
    />
  );
}
