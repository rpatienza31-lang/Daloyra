import type { Metadata } from "next";
import { AuthHeading } from "@/components/forms/auth-heading";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.auth.forgot.title} · ${copy.brand.name}` };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title={copy.auth.forgot.title} subtitle={copy.auth.forgot.subtitle} />
      <ForgotPasswordForm />
    </>
  );
}
