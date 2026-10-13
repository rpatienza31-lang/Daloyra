import type { Metadata } from "next";
import { PeoplePage } from "@/features/people/components/people-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.people.supplier.title} · ${copy.brand.name}` };

export default function SuppliersPage({ searchParams }: PageProps<"/suppliers">) {
  return <PeoplePage kind="supplier" searchParams={searchParams} />;
}
