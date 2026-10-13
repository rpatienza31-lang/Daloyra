"use client";

import { copy } from "@/lib/copy";

/**
 * Last-resort screen when the root layout itself fails. It renders its own document
 * without the app's styles, so it uses a few inline styles in the brand colors.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = copy.status;
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f4f6f9",
          color: "#0f172a",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 16,
        }}
      >
        <title>{`${t.errorTitle} · ${copy.brand.name}`}</title>
        <main style={{ maxWidth: 440 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{t.errorTitle}</h1>
          <p style={{ color: "#475569", margin: "0 0 24px" }}>{t.errorBody}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 10,
              border: 0,
              background: "#0f6b74",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {t.tryAgain}
          </button>
          {error.digest ? (
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 24 }}>
              {t.reference(error.digest)}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
