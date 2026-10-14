import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { BusinessList } from "@/features/admin/components/business-list";
import { listBusinesses } from "@/features/admin/queries";
import { ACCESS_STATES } from "@/features/admin/schema";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.admin.title} · ${copy.brand.name}` };

export default async function AdminPage() {
  const businesses = await listBusinesses();
  const t = copy.admin;
  const count = (a: (typeof ACCESS_STATES)[number]) =>
    businesses.filter((b) => b.access === a).length;
  const cards = [
    { label: t.cards.total, value: businesses.length },
    { label: t.cards.trial, value: count("trial") },
    { label: t.cards.ended, value: count("trial_ended") },
    { label: t.cards.paid, value: count("paid") },
    { label: t.cards.suspended, value: count("suspended") },
  ];

  return (
    <>
      <PageHeader title={t.businesses} description={t.subtitle} />
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-card border border-border bg-card p-4 shadow-soft">
            <dt className="text-sm text-muted-foreground">{c.label}</dt>
            <dd
              className="mt-1 font-heading text-2xl font-bold"
              data-testid={`admin-count-${c.label}`}
            >
              {c.value}
            </dd>
          </div>
        ))}
      </dl>
      <BusinessList businesses={businesses} />
    </>
  );
}
