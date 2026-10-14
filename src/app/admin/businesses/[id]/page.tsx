import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AccessBadge } from "@/features/admin/components/access-badge";
import { ActionLog } from "@/features/admin/components/action-log";
import { BusinessActions } from "@/features/admin/components/business-actions";
import { formatWhen } from "@/features/admin/format";
import { listActions, listBusinesses } from "@/features/admin/queries";
import { getLifetimePrice } from "@/features/billing/queries";
import { copy } from "@/lib/copy";
import { formatMoney } from "@/lib/money";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: `${copy.admin.title} · ${copy.brand.name}` };

export default async function AdminBusinessPage({ params }: PageProps<"/admin/businesses/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [businesses, actions, price] = await Promise.all([
    listBusinesses(),
    listActions(500),
    getLifetimePrice(),
  ]);
  const b = businesses.find((x) => x.id === id);
  if (!b) notFound();
  const t = copy.admin;
  const d = t.detail;
  const types: Record<string, string> = copy.onboarding.businessTypes;
  const facts = [
    { label: d.owner, value: b.ownerName ?? "—" },
    { label: d.email, value: b.ownerEmail ?? "—" },
    { label: d.type, value: b.businessType ? (types[b.businessType] ?? b.businessType) : "—" },
    { label: d.signedUp, value: formatWhen(b.createdAt) },
    { label: d.lastActive, value: formatWhen(b.lastActivity, true) },
    { label: d.plan, value: b.planName ?? "—" },
    ...(b.access === "trial" || b.access === "trial_ended"
      ? [{ label: d.trialEnds, value: formatWhen(b.trialEndsAt, true) }]
      : []),
  ];
  const counts = [
    { label: d.sales, value: b.sales },
    { label: d.purchases, value: b.purchases },
    { label: d.expenses, value: b.expenses },
    { label: d.customers, value: b.customers },
    { label: d.suppliers, value: b.suppliers },
    { label: d.members, value: b.members },
  ];

  return (
    <>
      <Link
        href="/admin"
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {d.back}
      </Link>
      <PageHeader title={b.name} />
      <div className="-mt-3 mb-6">
        <AccessBadge access={b.access} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <dl className="grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-5 shadow-soft sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-sm text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 font-medium break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
        <section
          aria-labelledby="counts-title"
          className="rounded-card border border-border bg-card p-5 shadow-soft"
        >
          <h2 id="counts-title" className="mb-3 text-sm font-semibold text-muted-foreground">
            {d.counts}
          </h2>
          <dl className="grid grid-cols-3 gap-3">
            {counts.map((c) => (
              <div key={c.label}>
                <dt className="text-xs text-muted-foreground">{c.label}</dt>
                <dd className="font-heading text-xl font-bold">{c.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section aria-labelledby="actions-title" className="mt-6 flex flex-col gap-3">
        <h2 id="actions-title" className="text-lg font-semibold">
          {d.actions}
        </h2>
        <BusinessActions
          businessId={b.id}
          businessName={b.name}
          access={b.access}
          price={formatMoney(price, "PHP")}
        />
      </section>
      <section aria-labelledby="history-title" className="mt-8 flex flex-col gap-3">
        <h2 id="history-title" className="text-lg font-semibold">
          {d.history}
        </h2>
        <ActionLog actions={actions.filter((a) => a.businessId === b.id)} showBusiness={false} />
      </section>
    </>
  );
}
