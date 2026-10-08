"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";
import { signUp } from "../actions";
import { signUpSchema } from "../schema";
import { ResendConfirmation } from "./resend-confirmation";

export function SignUpForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });
  const { errors } = form.formState;
  const t = copy.auth.signup;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signUp(values);
      if (result.ok) setSentTo(values.email);
      else setFormError(result.error);
    });
  });

  if (sentTo) {
    const c = copy.auth.checkEmail;
    return (
      <div className="flex flex-col gap-5">
        <MailCheck aria-hidden className="size-10 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{c.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{c.body(sentTo)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{c.spam}</p>
        </div>
        <ResendConfirmation email={sentTo} />
        <Link
          href={routes.login}
          className="text-center text-sm font-medium text-primary hover:underline"
        >
          {c.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <FormField id="fullName" label={copy.fields.fullName} error={errors.fullName?.message}>
        <Input
          id="fullName"
          autoComplete="name"
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={describedBy("fullName", errors.fullName?.message)}
          {...form.register("fullName")}
        />
      </FormField>

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

      <FormField
        id="password"
        label={copy.fields.password}
        hint={copy.fields.passwordHint}
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={describedBy(
            "password",
            errors.password?.message,
            copy.fields.passwordHint,
          )}
          {...form.register("password")}
        />
      </FormField>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.submitting : t.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t.haveAccount}{" "}
        <Link href={routes.login} className="font-medium text-primary hover:underline">
          {t.loginLink}
        </Link>
      </p>
    </form>
  );
}
