import type { Metadata } from "next";
import { ProductPage } from "@/features/products/components/product-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.products.title} · ${copy.brand.name}` };

export default async function ProductDetailPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  return <ProductPage id={id} />;
}
