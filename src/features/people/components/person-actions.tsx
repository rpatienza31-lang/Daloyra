"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import { setPersonArchived } from "../actions";
import type { Person, PersonKind } from "../schema";
import { PersonFormSheet } from "./person-form-sheet";

/** Edit and archive/restore buttons on a customer or supplier page. */
export function PersonActions({ kind, person }: { kind: PersonKind; person: Person }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = copy.people[kind];
  const archived = person.archivedAt !== null;

  function setArchived(value: boolean) {
    startTransition(async () => {
      const result = await setPersonArchived(kind, person.id, value);
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(value ? t.archivedToast : t.restoredToast);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        {copy.common.edit}
      </Button>
      {archived ? (
        <Button variant="outline" disabled={pending} onClick={() => setArchived(false)}>
          <ArchiveRestore aria-hidden />
          {copy.common.restore}
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <Archive aria-hidden />
          {copy.common.archive}
        </Button>
      )}

      <PersonFormSheet kind={kind} open={editing} onOpenChange={setEditing} person={person} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.archiveTitle}
        body={t.archiveBody}
        confirmLabel={copy.common.archive}
        cancelLabel={copy.common.cancel}
        pending={pending}
        onConfirm={() => setArchived(true)}
      />
    </>
  );
}
