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
import { requestPasswordReset } from "../actions";
import { emailOnlySchema } from "../schema";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const form = useForm({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: "" },
  });
  const { errors } = form.formState;
  const t = copy.auth.forgot;

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      setMessage(result.ok ? { ok: true, text: t.sent } : { ok: false, text: result.error });
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {message ? (
        <FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage>
      ) : null}

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

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.submitting : t.submit}
      </Button>

      <Link
        href={routes.login}
        className="text-center text-sm font-medium text-primary hover:underline"
      >
        {t.backToLogin}
      </Link>
    </form>
  );
}
