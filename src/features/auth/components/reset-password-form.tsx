"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { updatePassword } from "../actions";
import { resetPasswordSchema } from "../schema";

export function ResetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;
  const t = copy.auth.reset;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await updatePassword(values);
      if (!result.ok) setFormError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}

      <FormField
        id="password"
        label={copy.fields.newPassword}
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

      <FormField
        id="confirmPassword"
        label={copy.fields.confirmPassword}
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={describedBy("confirmPassword", errors.confirmPassword?.message)}
          {...form.register("confirmPassword")}
        />
      </FormField>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
