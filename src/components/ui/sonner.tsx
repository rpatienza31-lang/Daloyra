"use client";

import { Toaster as Sonner } from "sonner";

/** Success toasts (SPEC Section 11). Rendered once in the app layout. */
function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!rounded-card !border-border !bg-card !text-foreground !shadow-soft !font-sans",
        },
      }}
    />
  );
}

export { Toaster };
