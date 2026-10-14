import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ActionLog } from "@/features/admin/components/action-log";
import { listActions } from "@/features/admin/queries";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.admin.log} · ${copy.brand.name}` };

export default async function AdminLogPage() {
  const actions = await listActions();
  return (
    <>
      <PageHeader title={copy.admin.log} />
      <ActionLog actions={actions} />
    </>
  );
}
