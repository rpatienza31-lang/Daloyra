import type { Metadata } from "next";
import { PersonPage } from "@/features/people/components/person-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.people.customer.title} · ${copy.brand.name}` };

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  return <PersonPage kind="customer" id={id} />;
}
