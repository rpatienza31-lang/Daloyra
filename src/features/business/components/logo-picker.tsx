"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { LOGO_TYPES } from "../schema";

const c = copy.onboarding.steps.contact;

/**
 * Choose, preview and remove a logo. `currentUrl` shows the saved logo until a new
 * file is picked; `onRemoveCurrent` offers to remove it.
 */
export function LogoPicker({
  file,
  error,
  onChange,
  currentUrl,
  onRemoveCurrent,
}: {
  file: File | null;
  error: string | null;
  onChange: (file: File | null) => void;
  currentUrl?: string | null;
  onRemoveCurrent?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function select(next: File | null) {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return next ? URL.createObjectURL(next) : null;
    });
    onChange(next);
    if (!next && inputRef.current) inputRef.current.value = "";
  }

  const shown = file && previewUrl ? previewUrl : (currentUrl ?? null);

  return (
    <FormField id="logo" label={c.logo} optional hint={c.logoHint} error={error ?? undefined}>
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-muted">
          {shown ? (
            // A local blob preview or a signed storage link; next/image does not apply.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-contain" />
          ) : (
            <ImagePlus aria-hidden className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            {shown ? c.changeLogo : c.chooseLogo}
          </Button>
          {file ? (
            <Button type="button" variant="ghost" onClick={() => select(null)}>
              {c.removeLogo}
            </Button>
          ) : shown && onRemoveCurrent ? (
            <Button type="button" variant="ghost" onClick={onRemoveCurrent}>
              {c.removeLogo}
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          id="logo"
          type="file"
          accept={LOGO_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-describedby={describedBy("logo", error ?? undefined, c.logoHint)}
          onChange={(event) => select(event.target.files?.[0] ?? null)}
        />
      </div>
    </FormField>
  );
}
