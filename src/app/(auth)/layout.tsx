import Link from "next/link";
import { copy } from "@/lib/copy";
import { routes } from "@/lib/routes";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 md:py-16">
      <Link
        href={routes.home}
        className="self-start rounded-control font-heading text-lg font-bold text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {copy.brand.name}
      </Link>
      <div className="mt-8 rounded-card border border-border bg-card p-5 shadow-soft sm:p-6">
        {children}
      </div>
    </main>
  );
}
