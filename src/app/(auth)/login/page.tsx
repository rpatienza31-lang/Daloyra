import type { Metadata } from "next";
import { AuthHeading } from "@/components/forms/auth-heading";
import { FormMessage } from "@/components/forms/form-field";
import { LoginForm } from "@/features/auth/components/login-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.auth.login.title} · ${copy.brand.name}` };

const MESSAGES = {
  link_invalid: { tone: "error", text: copy.auth.confirm.linkInvalid },
  email_confirmed: { tone: "success", text: copy.auth.confirm.emailConfirmed },
} as const;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const messageKey = firstValue(params.message);
  const message =
    messageKey && messageKey in MESSAGES ? MESSAGES[messageKey as keyof typeof MESSAGES] : null;

  return (
    <>
      <AuthHeading title={copy.auth.login.title} subtitle={copy.auth.login.subtitle} />
      {message ? (
        <div className="mb-5">
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        </div>
      ) : null}
      <LoginForm next={firstValue(params.next)} />
    </>
  );
}
