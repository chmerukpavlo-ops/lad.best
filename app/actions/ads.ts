"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  AdActionState,
  AdPayment,
  AdPaymentListItem,
  ListingOption,
  WorkspaceMemberOption,
} from "@/lib/ads/types";
import {
  amountKopiykyToDb,
  emptyToNull,
  validateAdPaymentCorrect,
  validateAdPaymentCreate,
} from "@/lib/ads/validation";
import { getMemberGate } from "@/lib/auth/member-gate";
import { parsePositiveInt } from "@/lib/listings/validation";
import { resolveOptimisticUpdate } from "@/lib/listings/version";
import {
  dbAmountToKopiyky,
  sumKopiyky,
} from "@/lib/money/kopiyky";

const AD_SELECT =
  "id, workspace_id, listing_id, amount, paid_on, payer_id, note, status, correction_reason, version, client_request_id, created_by, updated_by, created_at, updated_at";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fail(code: AdActionState["code"], message: string): AdActionState {
  return { ok: false, code, message };
}

async function requireMemberClient(strict = false) {
  const gate = await getMemberGate(strict);
  if (!gate.ok) {
    return {
      ok: false as const,
      state: fail(
        gate.reason === "unauthorized" ? "unauthorized" : "error",
        gate.message,
      ),
    };
  }
  return {
    ok: true as const,
    user: gate.user,
    supabase: gate.supabase,
    workspaceId: gate.workspaceId,
  };
}

function revalidateAdPaths(listingId?: string, paymentId?: string) {
  revalidatePath("/app");
  revalidatePath("/app/ads");
  revalidatePath("/app/listings");
  if (listingId) {
    revalidatePath(`/app/listings/${listingId}`);
  }
  if (paymentId) {
    revalidatePath(`/app/ads/${paymentId}`);
  }
}

export async function listWorkspaceMembers(): Promise<{
  ok: boolean;
  members: WorkspaceMemberOption[];
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, members: [], message: gate.state.message };
  }

  const { data: memberships, error } = await gate.supabase
    .from("memberships")
    .select("profile_id, profiles(display_name)")
    .eq("workspace_id", gate.workspaceId);

  if (error) {
    return {
      ok: false,
      members: [],
      message: "Не вдалося завантажити учасників workspace.",
    };
  }

  const members: WorkspaceMemberOption[] = (memberships ?? []).map((row) => {
    const profiles = row.profiles as
      | { display_name: string | null }
      | { display_name: string | null }[]
      | null;
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;
    return {
      profile_id: row.profile_id as string,
      display_name: profile?.display_name ?? null,
    };
  });

  return { ok: true, members };
}

export async function listListingsForAds(): Promise<{
  ok: boolean;
  listings: ListingOption[];
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, listings: [], message: gate.state.message };
  }

  const { data, error } = await gate.supabase
    .from("listings")
    .select("id, title, status")
    .eq("workspace_id", gate.workspaceId)
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      listings: [],
      message: "Не вдалося завантажити оголошення.",
    };
  }

  return { ok: true, listings: (data ?? []) as ListingOption[] };
}

export async function listAdPayments(): Promise<{
  ok: boolean;
  payments: AdPaymentListItem[];
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, payments: [], message: gate.state.message };
  }

  const { data, error } = await gate.supabase
    .from("ad_payments")
    .select(
      `${AD_SELECT}, listings(title), profiles!ad_payments_payer_id_fkey(display_name)`,
    )
    .eq("workspace_id", gate.workspaceId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      payments: [],
      message:
        "Не вдалося завантажити рекламні платежі. Спробуйте пізніше.",
    };
  }

  const payments: AdPaymentListItem[] = (data ?? []).map((row) => {
    const base = row as AdPayment & {
      listings?: { title: string } | { title: string }[] | null;
      profiles?:
        | { display_name: string | null }
        | { display_name: string | null }[]
        | null;
    };
    const listing = Array.isArray(base.listings)
      ? base.listings[0]
      : base.listings;
    const payer = Array.isArray(base.profiles) ? base.profiles[0] : base.profiles;
    const payment = { ...base } as AdPayment & {
      listings?: unknown;
      profiles?: unknown;
    };
    delete payment.listings;
    delete payment.profiles;
    return {
      ...(payment as AdPayment),
      listing_title: listing?.title ?? "Оголошення",
      payer_display_name: payer?.display_name ?? null,
    };
  });

  return { ok: true, payments };
}

export async function getAdPayment(id: string): Promise<{
  ok: boolean;
  payment: AdPaymentListItem | null;
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, payment: null, message: gate.state.message };
  }

  const { data, error } = await gate.supabase
    .from("ad_payments")
    .select(
      `${AD_SELECT}, listings(title), profiles!ad_payments_payer_id_fkey(display_name)`,
    )
    .eq("id", id)
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      payment: null,
      message: "Не вдалося завантажити платіж.",
    };
  }
  if (!data) {
    return {
      ok: false,
      payment: null,
      message: "Платіж не знайдено або недоступний.",
    };
  }

  const base = data as AdPayment & {
    listings?: { title: string } | { title: string }[] | null;
    profiles?:
      | { display_name: string | null }
      | { display_name: string | null }[]
      | null;
  };
  const listing = Array.isArray(base.listings) ? base.listings[0] : base.listings;
  const payer = Array.isArray(base.profiles) ? base.profiles[0] : base.profiles;
  const payment = { ...base } as AdPayment & {
    listings?: unknown;
    profiles?: unknown;
  };
  delete payment.listings;
  delete payment.profiles;

  return {
    ok: true,
    payment: {
      ...(payment as AdPayment),
      listing_title: listing?.title ?? "Оголошення",
      payer_display_name: payer?.display_name ?? null,
    },
  };
}

export async function getListingAdSpendKopiyky(listingId: string): Promise<{
  ok: boolean;
  totalKopiyky: number;
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, totalKopiyky: 0, message: gate.state.message };
  }

  const { data: listing, error: listingError } = await gate.supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();

  if (listingError || !listing) {
    return {
      ok: false,
      totalKopiyky: 0,
      message: "Оголошення не знайдено або недоступне.",
    };
  }

  const { data, error } = await gate.supabase
    .from("ad_payments")
    .select("amount")
    .eq("workspace_id", gate.workspaceId)
    .eq("listing_id", listingId)
    .eq("status", "valid");

  if (error) {
    return {
      ok: false,
      totalKopiyky: 0,
      message: "Не вдалося підрахувати рекламу оголошення.",
    };
  }

  try {
    const totalKopiyky = sumKopiyky(
      (data ?? []).map((row) => dbAmountToKopiyky(row.amount)),
    );
    return { ok: true, totalKopiyky };
  } catch {
    return {
      ok: false,
      totalKopiyky: 0,
      message: "Помилка підрахунку сум реклами.",
    };
  }
}

export async function createAdPayment(
  _prev: AdActionState | null,
  formData: FormData,
): Promise<AdActionState> {
  const gate = await requireMemberClient(true);
  if (!gate.ok) {
    return gate.state;
  }

  const validated = validateAdPaymentCreate({
    listing_id: formString(formData, "listing_id"),
    amount: formString(formData, "amount"),
    paid_on: formString(formData, "paid_on"),
    payer_id: formString(formData, "payer_id"),
    note: formString(formData, "note"),
    client_request_id: formString(formData, "client_request_id"),
  });
  if (!validated.ok) {
    return fail("validation", validated.message);
  }

  const { value } = validated;

  const { data: listing, error: listingError } = await gate.supabase
    .from("listings")
    .select("id, workspace_id")
    .eq("id", value.listing_id)
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();

  if (listingError || !listing) {
    return fail("not_found", "Оголошення не знайдено у вашому workspace.");
  }

  const { data: payerMembership, error: payerError } = await gate.supabase
    .from("memberships")
    .select("profile_id")
    .eq("workspace_id", gate.workspaceId)
    .eq("profile_id", value.payer_id)
    .maybeSingle();

  if (payerError || !payerMembership) {
    return fail("validation", "Платник має бути учасником цього workspace.");
  }

  const insertPayload = {
    workspace_id: gate.workspaceId,
    listing_id: value.listing_id,
    amount: amountKopiykyToDb(value.amount_kopiyky),
    paid_on: value.paid_on,
    payer_id: value.payer_id,
    note: emptyToNull(value.note),
    status: "valid" as const,
    client_request_id: value.client_request_id,
  };

  const { data, error } = await gate.supabase
    .from("ad_payments")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    // Unique (workspace_id, client_request_id) → idempotent replay
    if (error.code === "23505") {
      const { data: existing } = await gate.supabase
        .from("ad_payments")
        .select("id, listing_id")
        .eq("workspace_id", gate.workspaceId)
        .eq("client_request_id", value.client_request_id)
        .maybeSingle();

      if (existing?.id) {
        revalidateAdPaths(existing.listing_id, existing.id);
        redirect(`/app/ads/${existing.id}`);
      }
    }

    return fail(
      "error",
      "Не вдалося зберегти платіж. Перевірте з’єднання і спробуйте ще раз.",
    );
  }

  if (!data?.id) {
    return fail("error", "Не вдалося зберегти платіж.");
  }

  revalidateAdPaths(value.listing_id, data.id);
  redirect(`/app/ads/${data.id}`);
}

export async function correctAdPayment(
  _prev: AdActionState | null,
  formData: FormData,
): Promise<AdActionState> {
  const gate = await requireMemberClient(true);
  if (!gate.ok) {
    return gate.state;
  }

  const paymentId = formString(formData, "id").trim();
  const expectedVersion = parsePositiveInt(formString(formData, "version"));
  if (!paymentId || expectedVersion === null) {
    return fail("validation", "Некоректні дані форми (id або version).");
  }

  const validated = validateAdPaymentCorrect({
    amount: formString(formData, "amount"),
    paid_on: formString(formData, "paid_on"),
    payer_id: formString(formData, "payer_id"),
    note: formString(formData, "note"),
    status: formString(formData, "status"),
    correction_reason: formString(formData, "correction_reason"),
  });
  if (!validated.ok) {
    return fail("validation", validated.message);
  }

  const { value } = validated;

  const { data: payerMembership, error: payerError } = await gate.supabase
    .from("memberships")
    .select("profile_id")
    .eq("workspace_id", gate.workspaceId)
    .eq("profile_id", value.payer_id)
    .maybeSingle();

  if (payerError || !payerMembership) {
    return fail("validation", "Платник має бути учасником цього workspace.");
  }

  const { data, error } = await gate.supabase
    .from("ad_payments")
    .update({
      amount: amountKopiykyToDb(value.amount_kopiyky),
      paid_on: value.paid_on,
      payer_id: value.payer_id,
      note: emptyToNull(value.note),
      status: value.status,
      correction_reason: value.correction_reason,
    })
    .eq("id", paymentId)
    .eq("workspace_id", gate.workspaceId)
    .eq("version", expectedVersion)
    .select(AD_SELECT)
    .maybeSingle();

  if (error) {
    return fail(
      "error",
      "Не вдалося зберегти виправлення. Перевірте з’єднання і спробуйте ще раз.",
    );
  }

  if (!data) {
    const { data: current } = await gate.supabase
      .from("ad_payments")
      .select("id, version")
      .eq("id", paymentId)
      .eq("workspace_id", gate.workspaceId)
      .maybeSingle();

    const outcome = resolveOptimisticUpdate({
      updated: null,
      current: current ? { id: current.id, version: current.version } : null,
    });

    if (outcome === "not_found") {
      return fail("not_found", "Платіж не знайдено або недоступний.");
    }

    return fail(
      "conflict",
      "Платіж змінено іншим учасником. Оновіть сторінку й застосуйте виправлення знову.",
    );
  }

  revalidateAdPaths(data.listing_id, data.id);
  return {
    ok: true,
    code: "ok",
    message:
      data.status === "void"
        ? "Платіж анульовано (з причиною в журналі)."
        : "Виправлення збережено.",
    paymentId: data.id,
  };
}
