"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import type { BusinessSettings } from "../queries";
import { updateBusinessSettings } from "../settings-actions";
import {
  BUSINESS_TYPES,
  CURRENCIES,
  businessSettingsSchema,
  logoProblem,
  type BusinessSettingsInput,
  type BusinessSettingsValues,
} from "../schema";
import { LogoPicker } from "./logo-picker";

const o = copy.onboarding.steps;
const s = copy.settings.business;

export function BusinessSettingsForm({
  settings,
  logoUrl,
  currencyLocked,
}: {
  settings: BusinessSettings;
  logoUrl: string | null;
  /** True once money records exist (decision D6). */
  currencyLocked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const form = useForm<BusinessSettingsInput, unknown, BusinessSettingsValues>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      name: settings.name,
      ownerName: settings.ownerName ?? "",
      businessType: (settings.businessType ?? "") as BusinessSettingsInput["businessType"],
      address: settings.address ?? "",
      contactNumber: settings.contactNumber ?? "",
      email: settings.email ?? "",
      currencyCode: settings.currencyCode as BusinessSettingsInput["currencyCode"],
      startingCash: settings.startingCash,
      startingBalanceDate: settings.startingBalanceDate,
    },
  });
  const { errors } = form.formState;
  const currencyCode = useWatch({ control: form.control, name: "currencyCode" });
  const startingCash = useWatch({ control: form.control, name: "startingCash" });
  const parsedCash = parseMoneyInput(startingCash === "" ? "0" : startingCash);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.set(key, value ?? ""));
    if (logo) data.set("logo", logo);
    else if (removeLogo) data.set("removeLogo", "1");
    startTransition(async () => {
      const result = await updateBusinessSettings(data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(copy.common.saved);
      setLogo(null);
      setRemoveLogo(false);
      router.refresh();
    });
  });

  function field(
    id: "name" | "ownerName" | "address" | "contactNumber" | "email",
    label: string,
    props: React.ComponentProps<typeof Input> = {},
    optional = true,
  ) {
    const error = errors[id]?.message;
    return (
      <FormField id={id} label={label} optional={optional} error={error}>
        <Input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error)}
          {...props}
          {...form.register(id)}
        />
      </FormField>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-8">
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{s.subtitle}</p>
        </div>
        {field("name", o.basics.name, { autoComplete: "organization" }, false)}
        {field("ownerName", o.basics.ownerName, { autoComplete: "name" })}
        <FormField id="businessType" label={o.basics.type} optional>
          <NativeSelect id="businessType" {...form.register("businessType")}>
            <option value="">{o.basics.typePlaceholder}</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {copy.onboarding.businessTypes[type]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        {field("address", o.contact.address, { autoComplete: "street-address" })}
        {field("contactNumber", o.contact.contactNumber, { type: "tel", inputMode: "tel" })}
        {field("email", o.contact.email, { type: "email", inputMode: "email" })}
        <LogoPicker
          file={logo}
          error={logoError}
          currentUrl={removeLogo ? null : logoUrl}
          onRemoveCurrent={() => setRemoveLogo(true)}
          onChange={(file) => {
            const problem = file ? logoProblem(file) : null;
            setLogoError(problem);
            setLogo(problem ? null : file);
          }}
        />
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold">{s.moneyTitle}</h2>
        <FormField
          id="currencyCode"
          label={o.money.currency}
          hint={currencyLocked ? s.currencyLocked : s.currencyHelp}
        >
          {currencyLocked ? (
            // Not registered: the saved currency is sent unchanged from the form's defaults.
            <Input
              id="currencyCode"
              readOnly
              value={
                CURRENCIES.find((c) => c.code === settings.currencyCode)?.label ??
                settings.currencyCode
              }
              aria-describedby={describedBy("currencyCode", undefined, s.currencyLocked)}
            />
          ) : (
            <NativeSelect
              id="currencyCode"
              aria-describedby={describedBy("currencyCode", undefined, s.currencyHelp)}
              {...form.register("currencyCode")}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          id="startingCash"
          label={o.money.startingCash}
          hint={o.money.startingCashHelp}
          error={errors.startingCash?.message}
        >
          <Input
            id="startingCash"
            inputMode="decimal"
            autoComplete="off"
            className="amount"
            aria-invalid={Boolean(errors.startingCash)}
            aria-describedby={describedBy(
              "startingCash",
              errors.startingCash?.message,
              o.money.startingCashHelp,
            )}
            {...form.register("startingCash")}
          />
        </FormField>
        {parsedCash !== null ? (
          <p className="-mt-3 text-xl font-semibold amount" aria-live="polite">
            {formatMoney(parsedCash, currencyCode)}
          </p>
        ) : null}
        <FormField
          id="startingBalanceDate"
          label={s.startingDate}
          hint={s.startingDateHelp}
          error={errors.startingBalanceDate ? s.dateInFuture : undefined}
        >
          <Input
            id="startingBalanceDate"
            type="date"
            aria-invalid={Boolean(errors.startingBalanceDate)}
            aria-describedby={describedBy(
              "startingBalanceDate",
              errors.startingBalanceDate ? s.dateInFuture : undefined,
              s.startingDateHelp,
            )}
            {...form.register("startingBalanceDate")}
          />
        </FormField>
      </section>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? copy.common.saving : copy.common.save}
      </Button>
    </form>
  );
}
