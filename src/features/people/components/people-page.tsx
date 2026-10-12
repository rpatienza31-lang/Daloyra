import { getCurrentBusiness } from "@/features/business/queries";
import { can } from "@/lib/permissions";
import { listPeople } from "../queries";
import type { PersonKind } from "../schema";
import { PeopleList } from "./people-list";

/** Server side of /customers and /suppliers. */
export async function PeoplePage({
  kind,
  searchParams,
}: {
  kind: PersonKind;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const showArchived = params.show === "archived";
  const people = await listPeople(kind, business.id, showArchived);

  return (
    <PeopleList
      kind={kind}
      people={people}
      showArchived={showArchived}
      canAdd={can(business.role, "people.add")}
      startAdding={params.new === "1"}
    />
  );
}
