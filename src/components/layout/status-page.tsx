import type { LucideIcon } from "lucide-react";

/** A calm full-width message for not-found and error screens. */
export function StatusPage({
  icon: Icon,
  title,
  body,
  footnote,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  footnote?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary shadow-soft">
        <Icon aria-hidden className="size-7" />
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
      {children ? <div className="mt-8 flex flex-col gap-3 sm:flex-row">{children}</div> : null}
      {footnote ? <p className="mt-6 text-xs text-muted-foreground">{footnote}</p> : null}
    </div>
  );
}
