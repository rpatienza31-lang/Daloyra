"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { savePerson } from "../actions";
import {
  PEOPLE_ROUTES,
  personSchema,
  type Person,
  type PersonInput,
  type PersonKind,
  type PersonValues,
} from "../schema";

interface Props {
  kind: PersonKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this person; omit to add a new one. */
  person?: Person;
}

export function PersonFormSheet({ kind, open, onOpenChange, person }: Props) {
  const t = copy.people[kind];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={person ? t.edit : t.add}>
        {/* Remount per opening so an add always starts empty with a fresh id. */}
        {open ? (
          <PersonForm kind={kind} person={person} onDone={() => onOpenChange(false)} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PersonForm({
  kind,
  person,
  onDone,
}: {
  kind: PersonKind;
  person?: Person;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  // The client chooses the id so a retried save cannot create a duplicate.
  const [newId] = useState(() => crypto.randomUUID());
  const form = useForm<PersonInput, unknown, PersonValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      id: person?.id ?? newId,
      name: person?.name ?? "",
      phone: person?.phone ?? "",
      email: person?.email ?? "",
      address: person?.address ?? "",
      notes: person?.notes ?? "",
    },
  });
  const { errors } = form.formState;
  const f = copy.people.fields;
  const t = copy.people[kind];

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await savePerson(kind, person ? "edit" : "add", {
        ...values,
        phone: values.phone ?? "",
        email: values.email ?? "",
        address: values.address ?? "",
        notes: values.notes ?? "",
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(person ? copy.common.saved : t.added);
      onDone();
      if (person) router.refresh();
      else router.push(`${PEOPLE_ROUTES[kind]}/${values.id}`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <FormField id="person-name" label={f.name} error={errors.name?.message}>
        <Input
          id="person-name"
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("person-name", errors.name?.message)}
          {...form.register("name")}
        />
      </FormField>
      <FormField id="person-phone" label={f.phone} optional error={errors.phone?.message}>
        <Input
          id="person-phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={describedBy("person-phone", errors.phone?.message)}
          {...form.register("phone")}
        />
      </FormField>
      <FormField id="person-email" label={f.email} optional error={errors.email?.message}>
        <Input
          id="person-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy("person-email", errors.email?.message)}
          {...form.register("email")}
        />
      </FormField>
      <FormField id="person-address" label={f.address} optional error={errors.address?.message}>
        <Input
          id="person-address"
          autoComplete="off"
          aria-invalid={Boolean(errors.address)}
          aria-describedby={describedBy("person-address", errors.address?.message)}
          {...form.register("address")}
        />
      </FormField>
      <FormField id="person-notes" label={f.notes} optional error={errors.notes?.message}>
        <Textarea
          id="person-notes"
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={describedBy("person-notes", errors.notes?.message)}
          {...form.register("notes")}
        />
      </FormField>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? copy.common.saving : copy.common.save}
      </Button>
    </form>
  );
}
