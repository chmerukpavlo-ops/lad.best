import { cache } from "react";

import { requireVerifiedUser, type VerifiedUser } from "@/lib/auth/require-user";
import { getMembershipWorkspace } from "@/lib/listings/workspace";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MemberGateOk = {
  ok: true;
  user: VerifiedUser;
  supabase: SupabaseClient;
  workspaceId: string;
};

export type MemberGateFail = {
  ok: false;
  message: string;
  reason: "unauthorized" | "error";
};

export type MemberGate = MemberGateOk | MemberGateFail;

const resolveMembership = cache(async (profileId: string) => {
  const supabase = await createClient();
  return getMembershipWorkspace(supabase, profileId);
});

/**
 * Shared member + workspace gate (deduped per request + strict flag).
 * strict=false → claims; strict=true → getUser (writes).
 */
export const getMemberGate = cache(
  async (strict: boolean): Promise<MemberGate> => {
    const user = await requireVerifiedUser({ withUserRecord: strict });
    const supabase = await createClient();
    const membership = await resolveMembership(user.id);
    if (!membership.ok) {
      return {
        ok: false,
        reason: membership.reason === "none" ? "unauthorized" : "error",
        message: membership.message,
      };
    }
    return {
      ok: true,
      user,
      supabase,
      workspaceId: membership.workspaceId,
    };
  },
);
