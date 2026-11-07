import { redirect } from "next/navigation";

import { AUTH_PATHS } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export type VerifiedUser = {
  id: string;
  email: string | undefined;
};

/**
 * Verifies the JWT with getClaims(). Optionally loads a fresh user via getUser()
 * when an Auth-server-confirmed record is needed (e.g. email).
 * Middleware alone is not enough for server operations.
 */
export async function requireVerifiedUser(options?: {
  withUserRecord?: boolean;
}): Promise<VerifiedUser> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    redirect(AUTH_PATHS.login);
  }

  if (!options?.withUserRecord) {
    const emailClaim = claimsData.claims.email;
    return {
      id: userId,
      email: typeof emailClaim === "string" ? emailClaim : undefined,
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.id !== userId) {
    redirect(AUTH_PATHS.login);
  }

  return {
    id: userData.user.id,
    email: userData.user.email,
  };
}
