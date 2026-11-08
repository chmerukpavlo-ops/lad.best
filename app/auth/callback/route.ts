import { NextResponse } from "next/server";

import {
  AUTH_PATHS,
  sameOriginRedirectUrl,
} from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges ?code= for a session (password recovery and other PKCE flows).
 * Redirect allow list in Supabase must include:
 *   http://localhost:3000/auth/callback
 *   http://127.0.0.1:3000/auth/callback
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get("code");
  const errorParam =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (errorParam) {
    const url = new URL(AUTH_PATHS.error, origin);
    url.searchParams.set("reason", "link");
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

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    const url = new URL(AUTH_PATHS.error, origin);
    url.searchParams.set("reason", "session");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(
    sameOriginRedirectUrl(
      requestUrl,
      searchParams.get("next"),
      AUTH_PATHS.updatePassword,
    ),
  );
}
