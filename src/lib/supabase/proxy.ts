import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie on every request so Server Components
 * see a valid session. Returns the response to send, carrying any new cookies.
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between client creation and this call: it validates the
  // token and triggers the refresh. Route protection is added in Phase 1.
  await supabase.auth.getClaims();

  return response;
}
