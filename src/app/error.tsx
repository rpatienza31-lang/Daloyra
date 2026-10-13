"use client";

import { ErrorScreen } from "@/components/layout/error-screen";
import { copy } from "@/lib/copy";

export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center">
      <ErrorScreen error={error} retry={retry} homeHref="/" homeLabel={copy.status.goHome} />
    </main>
  );
}
