import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { AUTH_PATHS, safeAuthNextPath } from "@/lib/auth/paths";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function copyAuthCookiesAndHeaders(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  for (const header of ["cache-control", "expires", "pragma"] as const) {
    const value = from.headers.get(header);
    if (value) {
      to.headers.set(header, value);
    }
  }
  return to;
}

/**
 * Refreshes the session via verified getClaims() and gates route access.
 * Does not replace per-request auth checks in Server Components / actions.
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabasePublicEnv();
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!env) {
    if (request.nextUrl.pathname.startsWith(AUTH_PATHS.app)) {
      const url = request.nextUrl.clone();
      url.pathname = AUTH_PATHS.login;
      url.searchParams.set("error", "env");
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub) && !error;

  const path = request.nextUrl.pathname;
  const isApp = path === AUTH_PATHS.app || path.startsWith(`${AUTH_PATHS.app}/`);
  const isAuthEntry =
    path === AUTH_PATHS.login || path === AUTH_PATHS.forgotPassword;

  if (isApp && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_PATHS.login;
    url.searchParams.set("next", path);
    return copyAuthCookiesAndHeaders(
      supabaseResponse,
      NextResponse.redirect(url),
    );
  }

  if (isAuthEntry && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = safeAuthNextPath(
      request.nextUrl.searchParams.get("next"),
      AUTH_PATHS.app,
    );
    url.search = "";
    return copyAuthCookiesAndHeaders(
      supabaseResponse,
      NextResponse.redirect(url),
    );
  }

  if (isApp) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    supabaseResponse.headers.set("Pragma", "no-cache");
    supabaseResponse.headers.set("Expires", "0");
  }

  return supabaseResponse;
}
