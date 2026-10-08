"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { createBusiness } from "../actions";
import {
  BUSINESS_TYPES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  LOGO_TYPES,
  ONBOARDING_STEPS,
  logoProblem,
  onboardingSchema,
  type OnboardingInput,
  type OnboardingValues,
} from "../schema";

const t = copy.onboarding;
const STEP_TITLES = [t.steps.basics.title, t.steps.contact.title, t.steps.money.title];

export function OnboardingWizard({ defaultOwnerName }: { defaultOwnerName?: string }) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isLastStep = step === ONBOARDING_STEPS.length - 1;

  // The client chooses the business id so a retried submit cannot create a duplicate.
  const [businessId] = useState(() => crypto.randomUUID());

  const form = useForm<OnboardingInput, unknown, OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      businessId,
      name: "",
      ownerName: defaultOwnerName ?? "",
      businessType: "",
      address: "",
      contactNumber: "",
      email: "",
      currencyCode: DEFAULT_CURRENCY,
      startingCash: "",
    },
  });
  const { errors } = form.formState;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  async function goNext() {
    if (await form.trigger([...ONBOARDING_STEPS[step]])) setStep((s) => s + 1);
  }

  const onSubmit = form.handleSubmit((values) => {
    if (!isLastStep) {
      void goNext();
      return;
    }
    setFormError(null);
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.set(key, value ?? ""));
    if (logo) data.set("logo", logo);
    startTransition(async () => {
      const result = await createBusiness(data);
      if (!result.ok) setFormError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-primary">
          {t.stepOf(step + 1, ONBOARDING_STEPS.length)}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-xl font-bold outline-none">
          {STEP_TITLES[step]}
        </h2>
        {step === 1 ? (
          <p className="mt-1 text-sm text-muted-foreground">{t.steps.contact.subtitle}</p>
        ) : null}
        <StepDots current={step} />
      </div>

      {formError ? <FormMessage>{formError}</FormMessage> : null}

      {step === 0 ? (
        <>
          <FormField id="name" label={t.steps.basics.name} error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="organization"
              placeholder={t.steps.basics.namePlaceholder}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy("name", errors.name?.message)}
              {...form.register("name")}
            />
          </FormField>
          <FormField
            id="ownerName"
            label={t.steps.basics.ownerName}
            optional
            error={errors.ownerName?.message}
          >
            <Input
              id="ownerName"
              autoComplete="name"
              aria-invalid={Boolean(errors.ownerName)}
              aria-describedby={describedBy("ownerName", errors.ownerName?.message)}
              {...form.register("ownerName")}
            />
          </FormField>
          <FormField
            id="businessType"
            label={t.steps.basics.type}
            optional
            error={errors.businessType?.message}
          >
            <NativeSelect id="businessType" {...form.register("businessType")}>
              <option value="">{t.steps.basics.typePlaceholder}</option>
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t.businessTypes[type]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <FormField
            id="address"
            label={t.steps.contact.address}
            optional
            error={errors.address?.message}
          >
            <Input
              id="address"
              autoComplete="street-address"
              aria-invalid={Boolean(errors.address)}
              aria-describedby={describedBy("address", errors.address?.message)}
              {...form.register("address")}
            />
          </FormField>
          <FormField
            id="contactNumber"
            label={t.steps.contact.contactNumber}
            optional
            error={errors.contactNumber?.message}
          >
            <Input
              id="contactNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={Boolean(errors.contactNumber)}
              aria-describedby={describedBy("contactNumber", errors.contactNumber?.message)}
              {...form.register("contactNumber")}
            />
          </FormField>
          <FormField
            id="email"
            label={t.steps.contact.email}
            optional
            error={errors.email?.message}
          >
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy("email", errors.email?.message)}
              {...form.register("email")}
            />
          </FormField>
          <LogoPicker
            file={logo}
            error={logoError}
            onChange={(file) => {
              const problem = file ? logoProblem(file) : null;
              setLogoError(problem);
              setLogo(problem ? null : file);
            }}
          />
        </>
      ) : null}

      {step === 2 ? <MoneyStep form={form} /> : null}

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => setStep((s) => s - 1)}
          >
            {copy.common.back}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {isLastStep
            ? pending
              ? t.steps.money.submitting
              : t.steps.money.submit
            : copy.common.next}
        </Button>
      </div>
    </form>
  );
}

function StepDots({ current }: { current: number }) {
  return (
    <div className="mt-3 flex gap-1.5" aria-hidden>
      {ONBOARDING_STEPS.map((_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i <= current ? "bg-primary" : "bg-muted"}`}
        />
      ))}
    </div>
  );
}

function MoneyStep({ form }: { form: UseFormReturn<OnboardingInput, unknown, OnboardingValues> }) {
  const { errors } = form.formState;
  const currencyCode = form.watch("currencyCode");
  const startingCash = form.watch("startingCash");
  const parsed = parseMoneyInput(startingCash === "" ? "0" : startingCash);
  const s = t.steps.money;

  return (
    <>
      <FormField id="currencyCode" label={s.currency} error={errors.currencyCode?.message}>
        <NativeSelect id="currencyCode" {...form.register("currencyCode")}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        id="startingCash"
        label={s.startingCash}
        hint={s.startingCashHelp}
        error={errors.startingCash?.message}
      >
        <Input
          id="startingCash"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          className="text-lg amount"
          aria-invalid={Boolean(errors.startingCash)}
          aria-describedby={describedBy(
            "startingCash",
            errors.startingCash?.message,
            s.startingCashHelp,
          )}
          {...form.register("startingCash")}
        />
      </FormField>
      {parsed !== null ? (
        <p className="-mt-2 text-2xl font-semibold amount" aria-live="polite">
          {formatMoney(parsed, currencyCode)}
        </p>
      ) : null}
    </>
  );
}

function LogoPicker({
  file,
  error,
  onChange,
}: {
  file: File | null;
  error: string | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const c = t.steps.contact;

  function select(next: File | null) {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return next ? URL.createObjectURL(next) : null;
    });
    onChange(next);
  }

  return (
    <FormField id="logo" label={c.logo} optional hint={c.logoHint} error={error ?? undefined}>
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-muted">
          {file && previewUrl ? (
            // A local blob preview; next/image does not apply.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="size-full object-contain" />
          ) : (
            <ImagePlus aria-hidden className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            {file ? c.changeLogo : c.chooseLogo}
          </Button>
          {file ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                select(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              {c.removeLogo}
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          id="logo"
          type="file"
          accept={LOGO_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-describedby={describedBy("logo", error ?? undefined, c.logoHint)}
          onChange={(event) => select(event.target.files?.[0] ?? null)}
        />
      </div>
    </FormField>
  );
}
