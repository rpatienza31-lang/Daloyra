import type { Metadata } from "next";
import { PeoplePage } from "@/features/people/components/people-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.people.customer.title} · ${copy.brand.name}` };

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return <PeoplePage kind="customer" searchParams={searchParams} />;
}
