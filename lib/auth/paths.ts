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

/** Production Auth redirect URLs for lad.best (document / configure in Supabase Dashboard). */
export const PRODUCTION_AUTH_REDIRECT_URLS = [
  "https://lad.best/auth/callback",
  "https://www.lad.best/auth/callback",
] as const;

const ALLOWED_EXACT_NEXT_PATHS = new Set<string>([
  AUTH_PATHS.app,
  AUTH_PATHS.updatePassword,
]);

/** `/app` and nested app routes (listings etc.); still rejects `//` and absolutes. */
function isAllowedNextPath(path: string): boolean {
  if (ALLOWED_EXACT_NEXT_PATHS.has(path)) {
    return true;
  }
  if (!path.startsWith(`${AUTH_PATHS.app}/`)) {
    return false;
  }
  if (path.includes("..") || path.includes("//")) {
    return false;
  }
  return true;
}

const DEFAULT_DEV_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

/** Only same-origin app origins (dev list + optional NEXT_PUBLIC_SITE_URL). */
export function safeAppOrigin(origin: string | null | undefined): string {
  const fallback = "http://localhost:3000";
  if (!origin) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return fallback;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fallback;
  }
  if (parsed.username || parsed.password) {
    return fallback;
  }

  const normalized = normalizeOrigin(parsed.origin);
  const site = process.env.NEXT_PUBLIC_SITE_URL
    ? normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
    : null;

  if (DEFAULT_DEV_ORIGINS.has(normalized) || (site && normalized === site)) {
    return normalized;
  }

  return fallback;
}

/** Password recovery: exchange code at callback, then open update-password. */
export function passwordRecoveryRedirectTo(origin: string): string {
  const safeOrigin = safeAppOrigin(origin);
  const next = encodeURIComponent(AUTH_PATHS.updatePassword);
  return `${safeOrigin}${AUTH_PATHS.callback}?next=${next}`;
}

/**
 * Open-redirect guard: only `/app` and `/auth/update-password`.
 * Rejects absolute URLs, protocol-relative paths, and anything else.
 */
export function safeAuthNextPath(
  next: string | null | undefined,
  fallback: string = AUTH_PATHS.app,
): string {
  const safeFallback = isAllowedNextPath(fallback)
    ? fallback
    : AUTH_PATHS.app;

  if (!next) {
    return safeFallback;
  }

  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("://") ||
    next.includes("\\") ||
    next.includes("@")
  ) {
    return safeFallback;
  }

  const pathOnly = next.split("?")[0]?.split("#")[0] ?? "";
  if (isAllowedNextPath(pathOnly)) {
    return pathOnly;
  }

  return safeFallback;
}

/** Build a same-origin absolute redirect URL for an allowlisted next path. */
export function sameOriginRedirectUrl(
  requestUrl: string | URL,
  next: string | null | undefined,
  fallback: string = AUTH_PATHS.app,
): URL {
  const request = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;
  const origin = safeAppOrigin(request.origin);
  const path = safeAuthNextPath(next, fallback);
  return new URL(path, `${origin}/`);
}
