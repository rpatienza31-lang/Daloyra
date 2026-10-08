import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/forms/auth-heading";
import { FormMessage } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getUserId } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: `${copy.auth.reset.title} · ${copy.brand.name}` };

export default async function ResetPasswordPage() {
  // The reset link signs the user in; without a session there is nothing to reset.
  const userId = await getUserId();
  const t = copy.auth.reset;

  return (
    <>
      <AuthHeading title={t.title} subtitle={userId ? t.subtitle : undefined} />
      {userId ? (
        <ResetPasswordForm />
      ) : (
        <div className="flex flex-col gap-5">
          <FormMessage>{t.noSession}</FormMessage>
          <Button asChild size="lg">
            <Link href={routes.forgotPassword}>{t.requestNew}</Link>
          </Button>
        </div>
      )}
    </>
  );
}
