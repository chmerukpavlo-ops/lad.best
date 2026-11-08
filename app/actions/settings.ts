"use server";

import { revalidatePath } from "next/cache";

import { getOrCreateScheduleSettings } from "@/app/actions/calendar";
import { listWorkspaceMembers } from "@/app/actions/ads";
import { getMemberGate } from "@/lib/auth/member-gate";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import {
  hhMmFromMinute,
  minuteOfDayFromHhMm,
} from "@/lib/calendar/kyiv";
import { parsePositiveInt } from "@/lib/listings/validation";
import { resolveOptimisticUpdate } from "@/lib/listings/version";
import {
  DEFAULT_RATING_WEIGHTS,
  normalizeWeights,
  parseWeight,
  type FinanceSettings,
  type RatingActionKey,
  type RatingSettings,
} from "@/lib/settings/finance-rating";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionState = {
  ok: boolean;
  code: "ok" | "validation" | "unauthorized" | "conflict" | "error";
  message: string;
};

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function fail(
  code: SettingsActionState["code"],
  message: string,
): SettingsActionState {
  return { ok: false, code, message };
}

export async function getOwnProfile(): Promise<{
  ok: boolean;
  profile: { id: string; display_name: string; email: string | undefined } | null;
  message?: string;
}> {
  const user = await requireVerifiedUser({ withUserRecord: true });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      profile: null,
      message: "Не вдалося завантажити профіль.",
    };
  }

  return {
    ok: true,
    profile: {
      id: data.id,
      display_name: data.display_name,
      email: user.email,
    },
  };
}

export async function updateDisplayName(
  _prev: SettingsActionState | null,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireVerifiedUser({ withUserRecord: true });
  const name = formString(formData, "display_name");
  if (name.length < 1 || name.length > 80) {
    return fail("validation", "Ім’я має бути від 1 до 80 символів.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return fail("error", "Не вдалося зберегти ім’я. Спробуйте пізніше.");
  }
  if (!data) {
    return fail("unauthorized", "Можна змінити лише своє ім’я.");
  }

  revalidatePath("/app");
  revalidatePath("/app/settings");
  revalidatePath("/app/calendar");
  revalidatePath("/app/sales");
  return { ok: true, code: "ok", message: "Ім’я збережено." };
}

export async function updateWorkHours(
  _prev: SettingsActionState | null,
  formData: FormData,
): Promise<SettingsActionState> {
  const gate = await getMemberGate(true);
  if (!gate.ok) {
    return fail(
      gate.reason === "unauthorized" ? "unauthorized" : "error",
      gate.message,
    );
  }

  const startRaw = formString(formData, "day_start");
  const endRaw = formString(formData, "day_end");
  const version = parsePositiveInt(formString(formData, "version"));
  if (version == null) {
    return fail("validation", "Застаріла форма. Оновіть сторінку.");
  }

  const start = minuteOfDayFromHhMm(startRaw);
  const end = minuteOfDayFromHhMm(endRaw);
  if (start == null || end == null) {
    return fail("validation", "Час має бути у форматі ГГ:ХХ.");
  }
  if (end <= start) {
    return fail("validation", "Кінець дня має бути пізніше за початок.");
  }

  // Ensure row exists
  const existing = await getOrCreateScheduleSettings();
  if (!existing.ok) {
    return fail("error", existing.message ?? "Не вдалося відкрити межі.");
  }

  const { data, error } = await gate.supabase
    .from("workspace_schedule_settings")
    .update({
      day_start_minute: start,
      day_end_minute: end,
    })
    .eq("workspace_id", gate.workspaceId)
    .eq("version", version)
    .select("workspace_id, version")
    .maybeSingle();

  if (error) {
    return fail("error", "Не вдалося зберегти робочі межі.");
  }

  if (!data) {
    const { data: current } = await gate.supabase
      .from("workspace_schedule_settings")
      .select("workspace_id, version")
      .eq("workspace_id", gate.workspaceId)
      .maybeSingle();
    const outcome = resolveOptimisticUpdate({
      updated: null,
      current: current
        ? { id: current.workspace_id, version: current.version }
        : null,
    });
    if (outcome === "not_found") {
      return fail("error", "Робочі межі ще не створені.");
    }
    return fail(
      "conflict",
      "Межі вже змінено іншим учасником. Оновіть сторінку.",
    );
  }

  revalidatePath("/app");
  revalidatePath("/app/settings");
  revalidatePath("/app/calendar");
  return {
    ok: true,
    code: "ok",
    message: `Збережено ${hhMmFromMinute(start)}–${hhMmFromMinute(end)} (Kyiv).`,
  };
}

export async function listSettingsMembers(): Promise<{
  ok: boolean;
  members: Array<{
    profile_id: string;
    display_name: string | null;
    isYou: boolean;
  }>;
  message?: string;
}> {
  const user = await requireVerifiedUser();
  const res = await listWorkspaceMembers();
  if (!res.ok) {
    return { ok: false, members: [], message: res.message };
  }
  return {
    ok: true,
    members: res.members.map((m) => ({
      profile_id: m.profile_id,
      display_name: m.display_name,
      isYou: m.profile_id === user.id,
    })),
  };
}

function orderedMemberIds(
  members: Array<{ profile_id: string }>,
): [string, string] | null {
  if (members.length < 2) return null;
  const sorted = [...members].map((m) => m.profile_id).sort();
  return [sorted[0]!, sorted[1]!];
}

export async function getOrCreateFinanceSettings(): Promise<{
  ok: boolean;
  settings: FinanceSettings | null;
  memberLabels: { a: string; b: string };
  message?: string;
  needsMembers?: boolean;
}> {
  const gate = await getMemberGate(false);
  const emptyLabels = { a: "Учасник 1", b: "Учасник 2" };
  if (!gate.ok) {
    return { ok: false, settings: null, memberLabels: emptyLabels, message: gate.message };
  }

  const membersRes = await listWorkspaceMembers();
  if (!membersRes.ok || membersRes.members.length < 2) {
    return {
      ok: false,
      settings: null,
      memberLabels: emptyLabels,
      needsMembers: true,
      message: "Потрібні двоє учасників workspace для часток.",
    };
  }

  const ids = orderedMemberIds(membersRes.members);
  if (!ids) {
    return {
      ok: false,
      settings: null,
      memberLabels: emptyLabels,
      needsMembers: true,
      message: "Потрібні двоє учасників workspace для часток.",
    };
  }
  const [aId, bId] = ids;
  const labelOf = (id: string) =>
    membersRes.members.find((m) => m.profile_id === id)?.display_name?.trim() ||
    "Учасник";

  const { data, error } = await gate.supabase
    .from("workspace_finance_settings")
    .select(
      "workspace_id, split_enabled, member_a_id, member_b_id, percent_a, percent_b, version",
    )
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      settings: null,
      memberLabels: { a: labelOf(aId), b: labelOf(bId) },
      message:
        "Не вдалося завантажити фінанси. Можливо, міграцію ще не застосовано.",
    };
  }

  if (data) {
    return {
      ok: true,
      settings: data as FinanceSettings,
      memberLabels: {
        a: labelOf(data.member_a_id),
        b: labelOf(data.member_b_id),
      },
    };
  }

  const { data: created, error: createError } = await gate.supabase
    .from("workspace_finance_settings")
    .insert({
      workspace_id: gate.workspaceId,
      split_enabled: false,
      member_a_id: aId,
      member_b_id: bId,
      percent_a: 40,
      percent_b: 60,
    })
    .select(
      "workspace_id, split_enabled, member_a_id, member_b_id, percent_a, percent_b, version",
    )
    .single();

  if (createError || !created) {
    const { data: again } = await gate.supabase
      .from("workspace_finance_settings")
      .select(
        "workspace_id, split_enabled, member_a_id, member_b_id, percent_a, percent_b, version",
      )
      .eq("workspace_id", gate.workspaceId)
      .maybeSingle();
    if (again) {
      return {
        ok: true,
        settings: again as FinanceSettings,
        memberLabels: {
          a: labelOf(again.member_a_id),
          b: labelOf(again.member_b_id),
        },
      };
    }
    return {
      ok: false,
      settings: null,
      memberLabels: { a: labelOf(aId), b: labelOf(bId) },
      message: "Не вдалося створити налаштування часток.",
    };
  }

  return {
    ok: true,
    settings: created as FinanceSettings,
    memberLabels: { a: labelOf(aId), b: labelOf(bId) },
  };
}

export async function updateFinanceSettings(
  _prev: SettingsActionState | null,
  formData: FormData,
): Promise<SettingsActionState> {
  const gate = await getMemberGate(true);
  if (!gate.ok) {
    return fail(
      gate.reason === "unauthorized" ? "unauthorized" : "error",
      gate.message,
    );
  }

  const version = parsePositiveInt(formString(formData, "version"));
  if (version == null) {
    return fail("validation", "Застаріла форма. Оновіть сторінку.");
  }

  const splitEnabled = formData.get("split_enabled") === "on";
  const percentA = parseWeight(formString(formData, "percent_a"));
  const percentB = parseWeight(formString(formData, "percent_b"));
  if (percentA == null || percentB == null) {
    return fail("validation", "Відсотки мають бути цілими 0–100.");
  }
  if (percentA + percentB !== 100) {
    return fail("validation", "Сума відсотків має бути 100%.");
  }

  const existing = await getOrCreateFinanceSettings();
  if (!existing.ok || !existing.settings) {
    return fail("error", existing.message ?? "Немає налаштувань часток.");
  }

  const { data, error } = await gate.supabase
    .from("workspace_finance_settings")
    .update({
      split_enabled: splitEnabled,
      percent_a: percentA,
      percent_b: percentB,
      member_a_id: existing.settings.member_a_id,
      member_b_id: existing.settings.member_b_id,
    })
    .eq("workspace_id", gate.workspaceId)
    .eq("version", version)
    .select("workspace_id, version")
    .maybeSingle();

  if (error) {
    return fail("error", "Не вдалося зберегти правило часток.");
  }
  if (!data) {
    return fail(
      "conflict",
      "Налаштування змінено іншим учасником. Оновіть сторінку.",
    );
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/sales");
  revalidatePath("/app/rating");
  return { ok: true, code: "ok", message: "Правило часток збережено." };
}

export async function getOrCreateRatingSettings(): Promise<{
  ok: boolean;
  settings: RatingSettings | null;
  message?: string;
}> {
  const gate = await getMemberGate(false);
  if (!gate.ok) {
    return { ok: false, settings: null, message: gate.message };
  }

  const { data, error } = await gate.supabase
    .from("workspace_rating_settings")
    .select("workspace_id, rating_enabled, weights, version")
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      settings: null,
      message:
        "Не вдалося завантажити рейтинг. Можливо, міграцію ще не застосовано.",
    };
  }

  if (data) {
    return {
      ok: true,
      settings: {
        workspace_id: data.workspace_id,
        rating_enabled: data.rating_enabled,
        weights: normalizeWeights(data.weights as Record<string, unknown>),
        version: data.version,
      },
    };
  }

  const { data: created, error: createError } = await gate.supabase
    .from("workspace_rating_settings")
    .insert({
      workspace_id: gate.workspaceId,
      rating_enabled: false,
      weights: DEFAULT_RATING_WEIGHTS,
    })
    .select("workspace_id, rating_enabled, weights, version")
    .single();

  if (createError || !created) {
    const { data: again } = await gate.supabase
      .from("workspace_rating_settings")
      .select("workspace_id, rating_enabled, weights, version")
      .eq("workspace_id", gate.workspaceId)
      .maybeSingle();
    if (again) {
      return {
        ok: true,
        settings: {
          workspace_id: again.workspace_id,
          rating_enabled: again.rating_enabled,
          weights: normalizeWeights(again.weights as Record<string, unknown>),
          version: again.version,
        },
      };
    }
    return {
      ok: false,
      settings: null,
      message: "Не вдалося створити налаштування рейтингу.",
    };
  }

  return {
    ok: true,
    settings: {
      workspace_id: created.workspace_id,
      rating_enabled: created.rating_enabled,
      weights: normalizeWeights(created.weights as Record<string, unknown>),
      version: created.version,
    },
  };
}

export async function updateRatingSettings(
  _prev: SettingsActionState | null,
  formData: FormData,
): Promise<SettingsActionState> {
  const gate = await getMemberGate(true);
  if (!gate.ok) {
    return fail(
      gate.reason === "unauthorized" ? "unauthorized" : "error",
      gate.message,
    );
  }

  const version = parsePositiveInt(formString(formData, "version"));
  if (version == null) {
    return fail("validation", "Застаріла форма. Оновіть сторінку.");
  }

  const ratingEnabled = formData.get("rating_enabled") === "on";
  const reset = formData.get("reset_defaults") === "1";
  const weights = reset
    ? { ...DEFAULT_RATING_WEIGHTS }
    : normalizeWeights(
        Object.fromEntries(
          (Object.keys(DEFAULT_RATING_WEIGHTS) as RatingActionKey[]).map(
            (key) => [key, formString(formData, `weight_${key}`)],
          ),
        ),
      );

  const existing = await getOrCreateRatingSettings();
  if (!existing.ok || !existing.settings) {
    return fail("error", existing.message ?? "Немає налаштувань рейтингу.");
  }

  const { data, error } = await gate.supabase
    .from("workspace_rating_settings")
    .update({
      rating_enabled: ratingEnabled,
      weights,
    })
    .eq("workspace_id", gate.workspaceId)
    .eq("version", version)
    .select("workspace_id, version")
    .maybeSingle();

  if (error) {
    return fail("error", "Не вдалося зберегти бали рейтингу.");
  }
  if (!data) {
    return fail(
      "conflict",
      "Налаштування змінено іншим учасником. Оновіть сторінку.",
    );
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/rating");
  return {
    ok: true,
    code: "ok",
    message: reset
      ? "Скинуто до початкових. Нові ваги — лише для нових дій."
      : "Бали збережено. Нові ваги — лише для нових дій.",
  };
}

export async function getRatingLeaderboard(): Promise<{
  ok: boolean;
  enabled: boolean;
  rows: Array<{ profile_id: string; display_name: string; points: number }>;
  message?: string;
}> {
  const gate = await getMemberGate(false);
  if (!gate.ok) {
    return { ok: false, enabled: false, rows: [], message: gate.message };
  }

  const settings = await getOrCreateRatingSettings();
  if (!settings.ok || !settings.settings) {
    return {
      ok: false,
      enabled: false,
      rows: [],
      message: settings.message,
    };
  }

  const membersRes = await listWorkspaceMembers();
  const members = membersRes.ok ? membersRes.members : [];

  const { data: events, error } = await gate.supabase
    .from("rating_events")
    .select("actor_id, points")
    .eq("workspace_id", gate.workspaceId);

  if (error) {
    return {
      ok: true,
      enabled: settings.settings.rating_enabled,
      rows: members.map((m) => ({
        profile_id: m.profile_id,
        display_name: m.display_name?.trim() || "Учасник",
        points: 0,
      })),
      message: "Подій рейтингу ще немає (або таблицю не застосовано).",
    };
  }

  const totals = new Map<string, number>();
  for (const m of members) totals.set(m.profile_id, 0);
  for (const ev of events ?? []) {
    totals.set(ev.actor_id, (totals.get(ev.actor_id) ?? 0) + (ev.points ?? 0));
  }

  const rows = [...totals.entries()]
    .map(([profile_id, points]) => ({
      profile_id,
      display_name:
        members.find((m) => m.profile_id === profile_id)?.display_name?.trim() ||
        "Учасник",
      points,
    }))
    .sort((a, b) => b.points - a.points);

  return {
    ok: true,
    enabled: settings.settings.rating_enabled,
    rows,
  };
}

