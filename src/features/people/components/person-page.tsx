import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, History, Plus } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaleCard } from "@/features/sales/components/sale-columns";
import { getAmountToCollect, listCustomerSales } from "@/features/sales/queries";
import { formatMoney } from "@/lib/money";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";
import { isUuid } from "@/lib/uuid";
import { getPerson } from "../queries";
import { PEOPLE_ROUTES, type PersonKind } from "../schema";
import { PersonActions } from "./person-actions";

/** Server side of /customers/[id] and /suppliers/[id]. */
export async function PersonPage({ kind, id }: { kind: PersonKind; id: string }) {
  const business = await getCurrentBusiness();
  if (!business || !isUuid(id)) notFound();
  const person = await getPerson(kind, business.id, id);
  if (!person) notFound();

  const t = copy.people[kind];
  const f = copy.people.fields;
  const details = [
    { label: f.phone, value: person.phone },
    { label: f.email, value: person.email },
    { label: f.address, value: person.address },
    { label: f.notes, value: person.notes },
  ].filter((d) => d.value);

  return (
    <>
      <Link
        href={PEOPLE_ROUTES[kind]}
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t.back}
      </Link>
      <PageHeader
        title={person.name}
        actions={
          can(business.role, "people.edit") ? <PersonActions kind={kind} person={person} /> : null
        }
      />
      {person.archivedAt ? (
        <Badge variant="muted" className="-mt-3 mb-6">
          {copy.common.archived}
        </Badge>
      ) : null}

      {details.length > 0 ? (
        <dl className="mb-6 grid gap-4 rounded-card border border-border bg-card p-5 shadow-soft sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.label}>
              <dt className="text-sm text-muted-foreground">{d.label}</dt>
              <dd className="mt-1 break-words whitespace-pre-line">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {kind === "customer" ? (
        <CustomerSales
          businessId={business.id}
          customerId={person.id}
          currencyCode={business.currencyCode}
          archived={person.archivedAt !== null}
        />
      ) : (
        <>
          <h2 className="mb-3 text-lg font-semibold">{t.historyTitle}</h2>
          <EmptyState icon={History} title={t.historyTitle} body={t.historyEmpty} />
        </>
      )}
    </>
  );
}

async function CustomerSales({
  businessId,
  customerId,
  currencyCode,
  archived,
}: {
  businessId: string;
  customerId: string;
  currencyCode: string;
  archived: boolean;
}) {
  const [sales, owed] = await Promise.all([
    listCustomerSales(businessId, customerId),
    getAmountToCollect(businessId, customerId),
  ]);
  const t = copy.people.customer;

  return (
    <section aria-labelledby="customer-sales">
      <div className="mb-4 rounded-card border border-border bg-card p-5 shadow-soft">
        <p className="text-sm font-medium text-muted-foreground">{t.owes}</p>
        <p className="mt-1 text-2xl font-semibold amount">{formatMoney(owed, currencyCode)}</p>
      </div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="customer-sales" className="text-lg font-semibold">
          {t.historyTitle}
        </h2>
        {archived ? null : (
          <Button asChild variant="outline">
            <Link href={`/sales/new?customer=${customerId}`}>
              <Plus aria-hidden />
              {copy.sales.add}
            </Link>
          </Button>
        )}
      </div>
      {sales.length === 0 ? (
        <EmptyState icon={History} title={t.historyTitle} body={t.historyEmpty} />
      ) : (
        <ul className="flex flex-col gap-2">
          {sales.map((sale) => (
            <li key={sale.id}>
              <Link
                href={`/sales/${sale.id}`}
                className="block min-h-11 rounded-card border border-border bg-card px-4 py-3 hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <SaleCard sale={sale} currencyCode={currencyCode} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
