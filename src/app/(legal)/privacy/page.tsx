import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: `${copy.legal.privacyPage.title} · ${copy.brand.name}`,
};

export default function PrivacyPage() {
  return <LegalPage page={copy.legal.privacyPage} />;
}
