"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/schema";
import { changePassword, updateProfile } from "../actions";
import { profileSchema, type ProfileInput } from "../schema";

const t = copy.settings.account;

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName },
  });
  const error = form.formState.errors.fullName?.message;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await updateProfile(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(copy.common.saved);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}
      <FormField id="fullName" label={copy.fields.fullName} error={error}>
        <Input
          id="fullName"
          autoComplete="name"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy("fullName", error)}
          {...form.register("fullName")}
        />
      </FormField>
      <FormField id="account-email" label={copy.fields.email} hint={t.emailHelp}>
        <Input id="account-email" value={email} readOnly aria-describedby="account-email-hint" />
      </FormField>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? copy.common.saving : copy.common.save}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await changePassword(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(t.passwordChanged);
      form.reset();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}
      <FormField
        id="new-password"
        label={copy.fields.newPassword}
        hint={copy.fields.passwordHint}
        error={errors.password?.message}
      >
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={describedBy(
            "new-password",
            errors.password?.message,
            copy.fields.passwordHint,
          )}
          {...form.register("password")}
        />
      </FormField>
      <FormField
        id="confirm-password"
        label={copy.fields.confirmPassword}
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={describedBy("confirm-password", errors.confirmPassword?.message)}
          {...form.register("confirmPassword")}
        />
      </FormField>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? copy.common.saving : t.passwordTitle}
      </Button>
    </form>
  );
}
