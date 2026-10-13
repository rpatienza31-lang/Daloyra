"use client";

import { ErrorScreen } from "@/components/layout/error-screen";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorScreen
      error={error}
      retry={retry}
      homeHref={routes.dashboard}
      homeLabel={copy.status.goDashboard}
    />
  );
}
