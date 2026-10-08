"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";
import { logIn } from "../actions";
import { logInSchema } from "../schema";
import { ResendConfirmation } from "./resend-confirmation";

export function LoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const form = useForm({
    resolver: zodResolver(logInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;
  const t = copy.auth.login;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    setNeedsConfirmation(false);
    startTransition(async () => {
      const result = await logIn(values, next);
      if (!result.ok) {
        setFormError(result.error);
        setNeedsConfirmation(result.code === "email_not_confirmed");
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}
      {needsConfirmation ? <ResendConfirmation email={form.getValues("email")} /> : null}

      <FormField id="email" label={copy.fields.email} error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy("email", errors.email?.message)}
          {...form.register("email")}
        />
      </FormField>

      <FormField id="password" label={copy.fields.password} error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={describedBy("password", errors.password?.message)}
          {...form.register("password")}
        />
      </FormField>

      <Link
        href={routes.forgotPassword}
        className="-mt-2 self-start text-sm font-medium text-primary hover:underline"
      >
        {t.forgot}
      </Link>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.submitting : t.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t.noAccount}{" "}
        <Link href={routes.signup} className="font-medium text-primary hover:underline">
          {t.signupLink}
        </Link>
      </p>
    </form>
  );
}
