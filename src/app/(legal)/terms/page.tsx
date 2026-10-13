import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: `${copy.legal.termsPage.title} · ${copy.brand.name}`,
};

export default function TermsPage() {
  return <LegalPage page={copy.legal.termsPage} />;
}
