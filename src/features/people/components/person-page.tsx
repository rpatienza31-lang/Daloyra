import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, History } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";
import { getPerson } from "../queries";
import { PEOPLE_ROUTES, type PersonKind } from "../schema";
import { PersonActions } from "./person-actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Server side of /customers/[id] and /suppliers/[id]. */
export async function PersonPage({ kind, id }: { kind: PersonKind; id: string }) {
  const business = await getCurrentBusiness();
  if (!business || !UUID.test(id)) notFound();
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

      <h2 className="mb-3 text-lg font-semibold">{t.historyTitle}</h2>
      <EmptyState icon={History} title={t.historyTitle} body={t.historyEmpty} />
    </>
  );
}
