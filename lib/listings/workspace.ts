import type { SupabaseClient } from "@supabase/supabase-js";

export type MembershipWorkspace = {
  workspaceId: string;
};

/**
 * Resolve the caller's single workspace membership.
 * Uses user-scoped client + RLS (no service_role).
 */
export async function getMembershipWorkspace(
  supabase: SupabaseClient,
  profileId: string,
): Promise<
  | { ok: true; workspaceId: string }
  | { ok: false; reason: "none" | "error"; message: string }
> {
  const { data, error } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("profile_id", profileId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "error",
      message: "Не вдалося перевірити доступ до workspace.",
    };
  }

  if (!data?.workspace_id) {
    return {
      ok: false,
      reason: "none",
      message: "Немає доступу до workspace.",
    };
  }

  return { ok: true, workspaceId: data.workspace_id };
}
