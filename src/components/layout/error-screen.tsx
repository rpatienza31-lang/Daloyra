"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

/** The body of an error boundary: what happened, what to do, and a code for support. */
export function ErrorScreen({
  error,
  retry,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  homeHref: string;
  homeLabel: string;
}) {
  const t = copy.status;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage
      icon={TriangleAlert}
      title={t.errorTitle}
      body={t.errorBody}
      footnote={error.digest ? t.reference(error.digest) : undefined}
    >
      <Button size="lg" onClick={() => retry()}>
        <RefreshCw aria-hidden />
        {t.tryAgain}
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href={homeHref}>{homeLabel}</Link>
      </Button>
    </StatusPage>
  );
}
