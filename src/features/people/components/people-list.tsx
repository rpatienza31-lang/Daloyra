"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Plus, UserRound } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { PEOPLE_ROUTES, type Person, type PersonKind } from "../schema";
import { PersonFormSheet } from "./person-form-sheet";

interface Props {
  kind: PersonKind;
  people: Person[];
  showArchived: boolean;
  canAdd: boolean;
  /** Open the add form straight away (from "+ New" or the dashboard). */
  startAdding: boolean;
}

const f = copy.people.fields;
const dash = (value: unknown) => (typeof value === "string" && value ? value : "—");

const columns: DataTableColumn<Person>[] = [
  { accessorKey: "name", header: f.name },
  { accessorKey: "phone", header: f.phone, cell: ({ getValue }) => dash(getValue()) },
  { accessorKey: "email", header: f.email, cell: ({ getValue }) => dash(getValue()) },
];

export function PeopleList({ kind, people, showArchived, canAdd, startAdding }: Props) {
  const [adding, setAdding] = useState(startAdding && canAdd);
  const t = copy.people[kind];
  const base = PEOPLE_ROUTES[kind];
  const Icon = kind === "customer" ? UserRound : Package;

  const addButton = canAdd ? (
    <Button onClick={() => setAdding(true)}>
      <Plus aria-hidden />
      {t.add}
    </Button>
  ) : null;

  return (
    <>
      <PageHeader title={t.title} actions={addButton} />

      <nav
        aria-label={t.title}
        className="mb-4 inline-flex gap-0.5 rounded-full bg-muted p-1 ring-1 ring-border/60 ring-inset"
      >
        {[
          { label: copy.common.active, href: base, selected: !showArchived },
          { label: copy.common.archived, href: `${base}?show=archived`, selected: showArchived },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium",
              tab.selected
                ? "bg-card font-semibold text-primary shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {people.length === 0 ? (
        showArchived ? (
          <p className="rounded-card border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {t.emptyArchived}
          </p>
        ) : (
          <EmptyState icon={Icon} title={t.emptyTitle} body={t.emptyBody} action={addButton} />
        )
      ) : (
        <DataTable
          columns={columns}
          data={people}
          getRowId={(p) => p.id}
          searchPlaceholder={t.searchPlaceholder}
          rowHref={(p) => `${base}/${p.id}`}
          renderCard={(p) => (
            <>
              <p className="truncate font-medium">{p.name}</p>
              {p.phone || p.email ? (
                <p className="truncate text-sm text-muted-foreground">{p.phone ?? p.email}</p>
              ) : null}
            </>
          )}
        />
      )}

      <PersonFormSheet kind={kind} open={adding} onOpenChange={setAdding} />
    </>
  );
}
