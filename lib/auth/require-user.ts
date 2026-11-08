import { cache } from "react";
import { redirect } from "next/navigation";

import { AUTH_PATHS } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export type VerifiedUser = {
  id: string;
  email: string | undefined;
};

/**
 * Claims-only gate (deduped per request). Middleware already refreshed the session.
 * Prefer for RSC reads / navigation. Not a substitute for RLS.
 */
const requireClaimsUser = cache(async (): Promise<VerifiedUser> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    redirect(AUTH_PATHS.login);
  }

  const emailClaim = claimsData.claims.email;
  return {
    id: userId,
    email: typeof emailClaim === "string" ? emailClaim : undefined,
  };
});

/**
 * Auth-server confirmation via getUser (deduped per request).
 * Prefer for mutations and sensitive writes.
 */
const requireRecordUser = cache(async (): Promise<VerifiedUser> => {
  const claimed = await requireClaimsUser();
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.id !== claimed.id) {
    redirect(AUTH_PATHS.login);
  }

  return {
    id: userData.user.id,
    email: userData.user.email,
  };
});

/**
 * Server auth gate. Default = claims (fast). withUserRecord = getUser (mutations).
 * Middleware alone is not enough. This is not instant JWT revocation for PostgREST.
 */
export async function requireVerifiedUser(options?: {
  withUserRecord?: boolean;
}): Promise<VerifiedUser> {
  if (options?.withUserRecord) {
    return requireRecordUser();
  }
  return requireClaimsUser();
}
