/**
 * Public Supabase env for browser + server clients.
 * Prefer publishable key; anon key accepted as legacy alias (same role).
 * Never put service_role here.
 */
export function getSupabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

export function requireSupabasePublicEnv(): { url: string; key: string } {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Відсутні NEXT_PUBLIC_SUPABASE_URL та publishable/anon key у середовищі.",
    );
  }
  return env;
}
