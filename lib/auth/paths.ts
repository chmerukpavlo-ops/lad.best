/** Canonical auth routes — keep Dashboard Redirect URLs in sync. */
export const AUTH_PATHS = {
  home: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  callback: "/auth/callback",
  updatePassword: "/auth/update-password",
  error: "/auth/error",
  app: "/app",
} as const;

/** Local redirect URLs to allow in Supabase Auth settings (dev). */
export const LOCAL_AUTH_REDIRECT_URLS = [
  "http://localhost:3000/auth/callback",
  "http://127.0.0.1:3000/auth/callback",
] as const;

/** Password recovery: exchange code at callback, then open update-password. */
export function passwordRecoveryRedirectTo(origin: string): string {
  const next = encodeURIComponent(AUTH_PATHS.updatePassword);
  return `${origin}${AUTH_PATHS.callback}?next=${next}`;
}

export function safeAuthNextPath(
  next: string | null | undefined,
  fallback: string = AUTH_PATHS.app,
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}
