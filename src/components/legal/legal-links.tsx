import Link from "next/link";
import { copy } from "@/lib/copy";

/** Privacy and Terms links for public pages. */
export function LegalLinks({ className }: { className?: string }) {
  const link =
    "inline-flex min-h-11 items-center rounded-control px-1 hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";
  return (
    <nav aria-label={`${copy.legal.privacy} · ${copy.legal.terms}`} className={className}>
      <ul className="flex gap-4 text-sm text-muted-foreground">
        <li>
          <Link href="/privacy" className={link}>
            {copy.legal.privacy}
          </Link>
        </li>
        <li>
          <Link href="/terms" className={link}>
            {copy.legal.terms}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
