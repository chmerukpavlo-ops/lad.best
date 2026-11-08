"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireVerifiedUser } from "@/lib/auth/require-user";
import type { Listing, ListingActionState } from "@/lib/listings/types";
import {
  emptyToNull,
  parseListingStatus,
  parsePositiveInt,
  validateListingInput,
} from "@/lib/listings/validation";
import { resolveOptimisticUpdate } from "@/lib/listings/version";
import { getMembershipWorkspace } from "@/lib/listings/workspace";
import { createClient } from "@/lib/supabase/server";

const LISTING_SELECT =
  "id, workspace_id, title, colors_text, description, notes, publication_url, status, version, created_by, updated_by, created_at, updated_at";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fail(
  code: ListingActionState["code"],
  message: string,
): ListingActionState {
  return { ok: false, code, message };
}

async function requireMemberClient() {
  const user = await requireVerifiedUser({ withUserRecord: true });
  const supabase = await createClient();
  const membership = await getMembershipWorkspace(supabase, user.id);
  if (!membership.ok) {
    return {
      ok: false as const,
      state: fail(
        membership.reason === "none" ? "unauthorized" : "error",
        membership.message,
      ),
    };
  }
  return {
    ok: true as const,
    user,
    supabase,
    workspaceId: membership.workspaceId,
  };
}

export async function createListing(
  _prev: ListingActionState | null,
  formData: FormData,
): Promise<ListingActionState> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return gate.state;
  }

  const validated = validateListingInput({
    title: formString(formData, "title"),
    colors_text: formString(formData, "colors_text"),
    description: formString(formData, "description"),
    notes: formString(formData, "notes"),
    publication_url: formString(formData, "publication_url"),
  });
  if (!validated.ok) {
    return fail("validation", validated.message);
  }

  const { value } = validated;
  const { data, error } = await gate.supabase
    .from("listings")
    .insert({
      workspace_id: gate.workspaceId,
      title: value.title,
      colors_text: emptyToNull(value.colors_text),
      description: emptyToNull(value.description),
      notes: emptyToNull(value.notes),
      publication_url: emptyToNull(value.publication_url),
      status: "active",
      // System fields ignored by trigger; omit forged client values.
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return fail(
      "error",
      "Не вдалося зберегти оголошення. Перевірте з’єднання і спробуйте ще раз.",
    );
  }

  revalidatePath("/app");
  revalidatePath("/app/listings");
  redirect(`/app/listings/${data.id}`);
}

export async function updateListing(
  _prev: ListingActionState | null,
  formData: FormData,
): Promise<ListingActionState> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return gate.state;
  }

  const listingId = formString(formData, "id").trim();
  const expectedVersion = parsePositiveInt(formString(formData, "version"));
  if (!listingId || expectedVersion === null) {
    return fail("validation", "Некоректні дані форми (id або version).");
  }

  const validated = validateListingInput({
    title: formString(formData, "title"),
    colors_text: formString(formData, "colors_text"),
    description: formString(formData, "description"),
    notes: formString(formData, "notes"),
    publication_url: formString(formData, "publication_url"),
  });
  if (!validated.ok) {
    return fail("validation", validated.message);
  }

  const { value } = validated;
  const { data, error } = await gate.supabase
    .from("listings")
    .update({
      title: value.title,
      colors_text: emptyToNull(value.colors_text),
      description: emptyToNull(value.description),
      notes: emptyToNull(value.notes),
      publication_url: emptyToNull(value.publication_url),
    })
    .eq("id", listingId)
    .eq("workspace_id", gate.workspaceId)
    .eq("version", expectedVersion)
    .select(LISTING_SELECT)
    .maybeSingle();

  if (error) {
    return fail(
      "error",
      "Не вдалося зберегти зміни. Перевірте з’єднання і спробуйте ще раз.",
    );
  }

  if (!data) {
    const { data: current } = await gate.supabase
      .from("listings")
      .select("id, version")
      .eq("id", listingId)
      .eq("workspace_id", gate.workspaceId)
      .maybeSingle();

    const outcome = resolveOptimisticUpdate({
      updated: null,
      current: current ? { id: current.id, version: current.version } : null,
    });

    if (outcome === "not_found") {
      return fail("not_found", "Оголошення не знайдено або недоступне.");
    }

    return fail(
      "conflict",
      "Оголошення змінено іншим учасником. Оновіть сторінку й застосуйте зміни знову.",
    );
  }

  revalidatePath("/app/listings");
  revalidatePath(`/app/listings/${listingId}`);
  return {
    ok: true,
    code: "ok",
    message: "Збережено.",
    listingId: data.id,
  };
}

export async function setListingStatus(
  _prev: ListingActionState | null,
  formData: FormData,
): Promise<ListingActionState> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return gate.state;
  }

  const listingId = formString(formData, "id").trim();
  const expectedVersion = parsePositiveInt(formString(formData, "version"));
  const status = parseListingStatus(formString(formData, "status"));

  if (!listingId || expectedVersion === null || !status) {
    return fail("validation", "Некоректні дані для зміни стану.");
  }

  const { data, error } = await gate.supabase
    .from("listings")
    .update({ status })
    .eq("id", listingId)
    .eq("workspace_id", gate.workspaceId)
    .eq("version", expectedVersion)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return fail(
      "error",
      "Не вдалося змінити стан. Перевірте з’єднання і спробуйте ще раз.",
    );
  }

  if (!data) {
    const { data: current } = await gate.supabase
      .from("listings")
      .select("id, version")
      .eq("id", listingId)
      .eq("workspace_id", gate.workspaceId)
      .maybeSingle();

    const outcome = resolveOptimisticUpdate({
      updated: null,
      current: current ? { id: current.id, version: current.version } : null,
    });

    if (outcome === "not_found") {
      return fail("not_found", "Оголошення не знайдено або недоступне.");
    }

    return fail(
      "conflict",
      "Оголошення змінено іншим учасником. Оновіть сторінку й спробуйте знову.",
    );
  }

  revalidatePath("/app/listings");
  revalidatePath(`/app/listings/${listingId}`);
  return {
    ok: true,
    code: "ok",
    message:
      data.status === "archived"
        ? "Оголошення в архіві."
        : "Оголошення знову активне.",
    listingId: data.id,
  };
}

export async function listListings(status: "active" | "archived"): Promise<{
  ok: boolean;
  listings: Listing[];
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, listings: [], message: gate.state.message };
  }

  const { data, error } = await gate.supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("workspace_id", gate.workspaceId)
    .eq("status", status)
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      listings: [],
      message:
        "Не вдалося завантажити оголошення. Спробуйте пізніше.",
    };
  }

  return { ok: true, listings: (data ?? []) as Listing[] };
}

export async function getListing(id: string): Promise<{
  ok: boolean;
  listing: Listing | null;
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, listing: null, message: gate.state.message };
  }

  const { data, error } = await gate.supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", id)
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      listing: null,
      message: "Не вдалося завантажити оголошення.",
    };
  }

  if (!data) {
    return {
      ok: false,
      listing: null,
      message: "Оголошення не знайдено або недоступне.",
    };
  }

  return { ok: true, listing: data as Listing };
}
