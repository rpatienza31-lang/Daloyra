import * as React from "react";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label, control, hint and inline error. The control must use `id`, and
 * `aria-describedby={describedBy(id, …)}` to connect the hint and error.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  optional,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">({copy.common.optional})</span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The aria-describedby value matching FormField's hint and error elements. */
export function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

/** A form-level message: an error (red) or a confirmation (teal). */
export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-control border px-4 py-3 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/20 bg-secondary text-secondary-foreground",
      )}
    >
      {children}
    </div>
  );
}
