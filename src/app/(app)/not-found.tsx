import Link from "next/link";
import { SearchX } from "lucide-react";
import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";

export default function AppNotFound() {
  const t = copy.status;
  return (
    <>
      <title>{`${t.notFoundTitle} · ${copy.brand.name}`}</title>
      <StatusPage icon={SearchX} title={t.notFoundTitle} body={t.notFoundBody}>
        <Button asChild size="lg">
          <Link href={routes.dashboard}>{t.goDashboard}</Link>
        </Button>
      </StatusPage>
    </>
  );
}
