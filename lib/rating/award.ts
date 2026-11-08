import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_RATING_WEIGHTS,
  type RatingActionKey,
  normalizeWeights,
} from "@/lib/settings/finance-rating";

/** Append a rating event if rating is enabled. Never throws to callers. */
export async function awardRatingPoints(args: {
  supabase: SupabaseClient;
  workspaceId: string;
  actorId: string;
  actionKey: RatingActionKey;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  try {
    const { data: settings } = await args.supabase
      .from("workspace_rating_settings")
      .select("rating_enabled, weights")
      .eq("workspace_id", args.workspaceId)
      .maybeSingle();

    if (!settings?.rating_enabled) return;

    const weights = normalizeWeights(
      (settings.weights ?? DEFAULT_RATING_WEIGHTS) as Record<string, unknown>,
    );
    const points = weights[args.actionKey] ?? 0;
    if (points <= 0) return;

    await args.supabase.from("rating_events").insert({
      workspace_id: args.workspaceId,
      actor_id: args.actorId,
      action_key: args.actionKey,
      points,
      entity_type: args.entityType ?? null,
      entity_id: args.entityId ?? null,
    });
  } catch {
    /* table may be missing until migration applied */
  }
}
