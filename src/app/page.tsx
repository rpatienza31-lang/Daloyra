import Link from "next/link";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16 md:px-8">
      <p className="font-heading text-lg font-bold text-primary">{copy.brand.name}</p>
      <h1 className="mt-6 text-[32px] leading-tight font-bold">{copy.landing.headline}</h1>
      <p className="mt-4 max-w-xl text-base text-muted-foreground">{copy.landing.subhead}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/signup">{copy.landing.startTrial}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">{copy.landing.login}</Link>
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{copy.landing.trialNote}</p>
    </main>
  );
}
