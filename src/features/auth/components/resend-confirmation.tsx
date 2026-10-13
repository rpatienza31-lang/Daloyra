"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { resendConfirmation } from "../actions";

export function ResendConfirmation({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const t = copy.auth.checkEmail;

  return (
    <div className="flex flex-col gap-3">
      {result ? (
        <FormMessage tone={result.ok ? "success" : "error"}>{result.message}</FormMessage>
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await resendConfirmation({ email });
            setResult(res.ok ? { ok: true, message: t.resent } : { ok: false, message: res.error });
          })
        }
      >
        {pending ? t.resending : t.resend}
      </Button>
    </div>
  );
}
