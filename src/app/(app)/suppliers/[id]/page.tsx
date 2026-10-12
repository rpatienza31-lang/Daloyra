import type { Metadata } from "next";
import { PersonPage } from "@/features/people/components/person-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.people.supplier.title} · ${copy.brand.name}` };

export default async function SupplierPage({ params }: PageProps<"/suppliers/[id]">) {
  const { id } = await params;
  return <PersonPage kind="supplier" id={id} />;
}
