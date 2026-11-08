import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

import { requireSupabasePublicEnv } from "@/lib/supabase/env";

/** One Supabase server client per RSC/request (cookie store shared). */
export const createClient = cache(async () => {
  const { url, key } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          // Cache headers from SSR package; layout also sets no-store for /app.
          void headers;
        } catch {
          // Called from a Server Component — middleware refreshes the session.
        }
      },
    },
  });
});
