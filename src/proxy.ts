import type { NextRequest } from "next/server";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";
import { buildContentSecurityPolicy } from "@/lib/security";
import { isPublicPath, isSignedOutOnlyPath, routes } from "@/lib/routes";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  // Next.js reads the nonce from the request CSP header and applies it to its scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { response, isSignedIn } = await updateSession(request, requestHeaders);
  const { pathname, search } = request.nextUrl;

  // Optimistic redirects only. Layouts, Server Actions and RLS do the real checks.
  if (!isSignedIn && !isPublicPath(pathname)) {
    const url = new URL(routes.login, request.url);
    url.searchParams.set("next", pathname + search);
    return redirectWithCookies(url, response);
  }
  if (isSignedIn && isSignedOutOnlyPath(pathname)) {
    return redirectWithCookies(new URL(routes.dashboard, request.url), response);
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
