import { NextResponse } from "next/server";

import { AUTH_PATHS, safeAuthNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges ?code= for a session (password recovery and other PKCE flows).
 * Redirect allow list in Supabase must include:
 *   http://localhost:3000/auth/callback
 *   http://127.0.0.1:3000/auth/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAuthNextPath(
    searchParams.get("next"),
    AUTH_PATHS.updatePassword,
  );
  const errorDescription =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (errorDescription) {
    const url = new URL(AUTH_PATHS.error, origin);
    url.searchParams.set("reason", "link");
    url.searchParams.set("detail", errorDescription);
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL(AUTH_PATHS.error, origin);
    url.searchParams.set("reason", "missing_code");
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL(AUTH_PATHS.error, origin);
    url.searchParams.set("reason", "expired");
    return NextResponse.redirect(url);
  }

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    const url = new URL(AUTH_PATHS.error, origin);
    url.searchParams.set("reason", "session");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, origin));
}
