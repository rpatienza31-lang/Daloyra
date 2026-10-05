import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Daloyra",
  description: "Simple accounting and business tracking for small business owners.",
};

export const viewport: Viewport = {
  themeColor: "#0F6B74",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading request headers makes every page render per request, which the
  // nonce-based Content-Security-Policy set in src/proxy.ts requires.
  await headers();

  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
