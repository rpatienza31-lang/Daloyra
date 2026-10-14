"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { BadgeCheck, CalendarPlus, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { activateLifetime, extendTrial, setBusinessStatus } from "../actions";
import { EXTEND_DAYS, type AccessState } from "../schema";

const t = copy.admin;
type Kind = "activate" | "extend" | "suspend" | "reactivate";

/** Activate the paid plan, extend the trial, pause or reactivate. Each asks to confirm. */
export function BusinessActions({
  businessId,
  businessName,
  access,
  price,
}: {
  businessId: string;
  businessName: string;
  access: AccessState;
  price: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [text, setText] = useState("");
  const [days, setDays] = useState<(typeof EXTEND_DAYS)[number]>(14);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const onTrial = access === "trial" || access === "trial_ended";

  function close() {
    setOpen(null);
    setText("");
    setError(null);
  }

  function confirm() {
    if (!open) return;
    setError(null);
    startTransition(async () => {
      const result =
        open === "activate"
          ? await activateLifetime({ businessId, note: text })
          : open === "extend"
            ? await extendTrial({ businessId, days, note: text })
            : await setBusinessStatus({
                businessId,
                status: open === "suspend" ? "suspended" : "active",
                reason: text,
              });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        open === "activate"
          ? t.activated
          : open === "extend"
            ? t.extended
            : open === "suspend"
              ? t.suspended
              : t.reactivated,
      );
      close();
      router.refresh();
    });
  }

  const dialog = {
    activate: {
      title: t.activateTitle,
      body: t.activateBody(businessName, price),
      label: t.activateNote,
    },
    extend: { title: t.extendTitle, body: t.extendBody, label: t.note },
    suspend: { title: t.suspendTitle, body: t.suspendBody, label: t.reason },
    reactivate: { title: t.reactivate, body: "", label: t.note },
  } as const;

  return (
    <div className="flex flex-wrap gap-2">
      {access !== "paid" && access !== "suspended" ? (
        <Button onClick={() => setOpen("activate")}>
          <BadgeCheck aria-hidden />
          {t.activate}
        </Button>
      ) : null}
      {onTrial ? (
        <Button variant="outline" onClick={() => setOpen("extend")}>
          <CalendarPlus aria-hidden />
          {t.extend}
        </Button>
      ) : null}
      {access === "suspended" ? (
        <Button variant="outline" onClick={() => setOpen("reactivate")}>
          <PlayCircle aria-hidden />
          {t.reactivate}
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen("suspend")}>
          <PauseCircle aria-hidden />
          {t.suspend}
        </Button>
      )}

      <AlertDialogPrimitive.Root open={open !== null} onOpenChange={(o) => !o && close()}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
          <AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-card p-6 shadow-soft">
            {open ? (
              <>
                <AlertDialogPrimitive.Title className="font-heading text-lg font-bold">
                  {dialog[open].title}
                </AlertDialogPrimitive.Title>
                <AlertDialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                  {dialog[open].body || businessName}
                </AlertDialogPrimitive.Description>
                <div className="mt-4 flex flex-col gap-4">
                  {error ? <FormMessage>{error}</FormMessage> : null}
                  {open === "extend" ? (
                    <FormField id="extend-days" label={t.extend}>
                      <NativeSelect
                        id="extend-days"
                        value={days}
                        onChange={(e) =>
                          setDays(Number(e.target.value) as (typeof EXTEND_DAYS)[number])
                        }
                      >
                        {EXTEND_DAYS.map((d) => (
                          <option key={d} value={d}>
                            {t.extendDays(d)}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                  ) : null}
                  <FormField
                    id="admin-note"
                    label={dialog[open].label}
                    optional={open !== "suspend"}
                  >
                    <Input
                      id="admin-note"
                      value={text}
                      maxLength={500}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </FormField>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <AlertDialogPrimitive.Cancel className={buttonVariants({ variant: "outline" })}>
                    {copy.common.cancel}
                  </AlertDialogPrimitive.Cancel>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={confirm}
                    className={cn(
                      buttonVariants({ variant: open === "suspend" ? "destructive" : "default" }),
                    )}
                  >
                    {pending ? copy.common.saving : t.confirm}
                  </button>
                </div>
              </>
            ) : null}
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </div>
  );
}
