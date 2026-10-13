import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";

interface LegalSection {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
}

/** Renders the Privacy Policy or Terms of Use from copy.ts. */
export function LegalPage({
  page,
}: {
  page: { title: string; updatedOn: string; intro: string; sections: readonly LegalSection[] };
}) {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const t = copy.legal;
  return (
    <article className="flex flex-col gap-8">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight">{page.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.updated(formatDate(page.updatedOn))}
        </p>
        <p className="mt-4 text-base">{page.intro}</p>
      </header>
      {page.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.bullets ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground marker:text-primary">
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          {section.paragraphs?.map((p) => (
            <p key={p} className="text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
      <p className="rounded-card border border-border bg-card p-4 text-sm shadow-soft">
        {email ? t.contactWithEmail(email) : t.contactNoEmail}
      </p>
    </article>
  );
}
