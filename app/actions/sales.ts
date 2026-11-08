"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ListingOption, WorkspaceMemberOption } from "@/lib/ads/types";
import { listListingsForAds, listWorkspaceMembers } from "@/app/actions/ads";
import type {
  Sale,
  SaleActionState,
  SaleListItem,
} from "@/lib/sales/types";
import {
  amountKopiykyToDb,
  emptyToNull,
  parseBusinessDate,
  validateSaleCorrect,
  validateSaleCreate,
  validateSaleUpdate,
} from "@/lib/sales/validation";
import { getMemberGate } from "@/lib/auth/member-gate";
import { parsePositiveInt } from "@/lib/listings/validation";
import { resolveOptimisticUpdate } from "@/lib/listings/version";
import { awardRatingPoints } from "@/lib/rating/award";
import { parseWeight } from "@/lib/settings/finance-rating";
import { getOrCreateFinanceSettings } from "@/app/actions/settings";

const SALE_SELECT =
  "id, workspace_id, listing_id, sale_price, cost_price, direct_expenses, color_text, size_text, note, executor_id, sold_on, status, margin, completed_on, completed_at, completed_by, correction_reason, version, client_request_id, complete_request_id, created_by, updated_by, created_at, updated_at";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fail(code: SaleActionState["code"], message: string): SaleActionState {
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

function revalidateSalePaths(listingId?: string, saleId?: string) {
  revalidatePath("/app");
  revalidatePath("/app/sales");
  revalidatePath("/app/listings");
  if (listingId) {
    revalidatePath(`/app/listings/${listingId}`);
  }
  if (saleId) {
    revalidatePath(`/app/sales/${saleId}`);
  }
}

function mapSaleRow(row: Sale & {
  listings?: { title: string } | { title: string }[] | null;
  profiles?:
    | { display_name: string | null }
    | { display_name: string | null }[]
    | null;
}): SaleListItem {
  const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
  const executor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const payment = { ...row } as Sale & {
    listings?: unknown;
    profiles?: unknown;
  };
  delete payment.listings;
  delete payment.profiles;
  return {
    ...(payment as Sale),
    listing_title: listing?.title ?? "Оголошення",
    executor_display_name: executor?.display_name ?? null,
  };
}

export async function listSalesMembers(): Promise<{
  ok: boolean;
  members: WorkspaceMemberOption[];
  message?: string;
}> {
  return listWorkspaceMembers();
}

export async function listSalesListings(): Promise<{
  ok: boolean;
  listings: ListingOption[];
  message?: string;
}> {
  return listListingsForAds();
}

export async function listSales(status?: "open" | "completed" | "cancelled"): Promise<{
  ok: boolean;
  sales: SaleListItem[];
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, sales: [], message: gate.state.message };
  }

  let query = gate.supabase
    .from("sales")
    .select(
      `${SALE_SELECT}, listings(title), profiles!sales_executor_id_fkey(display_name)`,
    )
    .eq("workspace_id", gate.workspaceId)
    .order("sold_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      sales: [],
      message:
        "Не вдалося завантажити продажі. Спробуйте пізніше.",
    };
  }

  return {
    ok: true,
    sales: (data ?? []).map((row) =>
      mapSaleRow(
        row as unknown as Sale & {
          listings?: { title: string } | { title: string }[] | null;
          profiles?:
            | { display_name: string | null }
            | { display_name: string | null }[]
            | null;
        },
      ),
    ),
  };
}

export async function getSale(id: string): Promise<{
  ok: boolean;
  sale: SaleListItem | null;
  message?: string;
}> {
  const gate = await requireMemberClient();
  if (!gate.ok) {
    return { ok: false, sale: null, message: gate.state.message };
  }

  const { data, error } = await gate.supabase
    .from("sales")
    .select(
      `${SALE_SELECT}, listings(title), profiles!sales_executor_id_fkey(display_name)`,
    )
    .eq("id", id)
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();

  if (error) {
    return { ok: false, sale: null, message: "Не вдалося завантажити продаж." };
  }
  if (!data) {
    return {
      ok: false,
      sale: null,
      message: "Продаж не знайдено або недоступний.",
    };
  }

  return {
    ok: true,
    sale: mapSaleRow(
      data as unknown as Sale & {
        listings?: { title: string } | { title: string }[] | null;
        profiles?:
          | { display_name: string | null }
          | { display_name: string | null }[]
          | null;
      },
    ),
  };
}

export async function createSale(
  _prev: SaleActionState | null,
  formData: FormData,
): Promise<SaleActionState> {
  const gate = await requireMemberClient(true);
  if (!gate.ok) {
    return gate.state;
  }

  const validated = validateSaleCreate({
    listing_id: formString(formData, "listing_id"),
    sale_price: formString(formData, "sale_price"),
    cost_price: formString(formData, "cost_price"),
    direct_expenses: formString(formData, "direct_expenses"),
    color_text: formString(formData, "color_text"),
    size_text: formString(formData, "size_text"),
    note: formString(formData, "note"),
    executor_id: formString(formData, "executor_id"),
    sold_on: formString(formData, "sold_on"),
    client_request_id: formString(formData, "client_request_id"),
  });
  if (!validated.ok) {
    return fail("validation", validated.message);
  }
  const { value } = validated;

  const { data: listing } = await gate.supabase
    .from("listings")
    .select("id")
    .eq("id", value.listing_id)
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();
  if (!listing) {
    return fail("not_found", "Оголошення не знайдено у вашому workspace.");
  }

  const { data: executor } = await gate.supabase
    .from("memberships")
    .select("profile_id")
    .eq("workspace_id", gate.workspaceId)
    .eq("profile_id", value.executor_id)
    .maybeSingle();
  if (!executor) {
    return fail("validation", "Виконавець має бути учасником workspace.");
  }

  const { data, error } = await gate.supabase
    .from("sales")
    .insert({
      workspace_id: gate.workspaceId,
      listing_id: value.listing_id,
      sale_price: amountKopiykyToDb(value.sale_price_kopiyky),
      cost_price: amountKopiykyToDb(value.cost_price_kopiyky),
      direct_expenses: amountKopiykyToDb(value.direct_expenses_kopiyky),
      color_text: emptyToNull(value.color_text),
      size_text: emptyToNull(value.size_text),
      note: emptyToNull(value.note),
      executor_id: value.executor_id,
      sold_on: value.sold_on,
      status: "open",
      client_request_id: value.client_request_id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await gate.supabase
        .from("sales")
        .select("id, listing_id")
        .eq("workspace_id", gate.workspaceId)
        .eq("client_request_id", value.client_request_id)
        .maybeSingle();
      if (existing?.id) {
        revalidateSalePaths(existing.listing_id, existing.id);
        redirect(`/app/sales/${existing.id}`);
      }
    }
    return fail(
      "error",
      "Не вдалося зберегти продаж. Перевірте з’єднання і спробуйте ще раз.",
    );
  }

  if (!data?.id) {
    return fail("error", "Не вдалося зберегти продаж.");
  }

  // Snapshot default profit split (no payouts) when enabled.
  try {
    const finance = await getOrCreateFinanceSettings();
    if (finance.ok && finance.settings) {
      const formPctA = parseWeight(formString(formData, "percent_a"));
      const formPctB = parseWeight(formString(formData, "percent_b"));
      const percentA = formPctA ?? finance.settings.percent_a;
      const percentB = formPctB ?? finance.settings.percent_b;
      const enabled =
        formData.get("split_enabled") === "on" ||
        (formData.get("split_enabled") == null &&
          finance.settings.split_enabled);

      if (percentA + percentB === 100) {
        await gate.supabase.from("sale_profit_splits").insert({
          sale_id: data.id,
          workspace_id: gate.workspaceId,
          enabled,
          member_a_id: finance.settings.member_a_id,
          member_b_id: finance.settings.member_b_id,
          percent_a: percentA,
          percent_b: percentB,
        });
      }
    }
  } catch {
    /* migration may be pending */
  }

  revalidateSalePaths(value.listing_id, data.id);
  redirect(`/app/sales/${data.id}`);
}

export async function updateOpenSale(
  _prev: SaleActionState | null,
  formData: FormData,
): Promise<SaleActionState> {
  const gate = await requireMemberClient(true);
  if (!gate.ok) {
    return gate.state;
  }

  const saleId = formString(formData, "id").trim();
  const expectedVersion = parsePositiveInt(formString(formData, "version"));
  if (!saleId || expectedVersion === null) {
    return fail("validation", "Некоректні дані форми (id або version).");
  }

  const validated = validateSaleUpdate({
    sale_price: formString(formData, "sale_price"),
    cost_price: formString(formData, "cost_price"),
    direct_expenses: formString(formData, "direct_expenses"),
    color_text: formString(formData, "color_text"),
    size_text: formString(formData, "size_text"),
    note: formString(formData, "note"),
    executor_id: formString(formData, "executor_id"),
    sold_on: formString(formData, "sold_on"),
  });
  if (!validated.ok) {
    return fail("validation", validated.message);
  }
  const { value } = validated;

  const { data: executor } = await gate.supabase
    .from("memberships")
    .select("profile_id")
    .eq("workspace_id", gate.workspaceId)
    .eq("profile_id", value.executor_id)
    .maybeSingle();
  if (!executor) {
    return fail("validation", "Виконавець має бути учасником workspace.");
  }

  const { data, error } = await gate.supabase
    .from("sales")
    .update({
      sale_price: amountKopiykyToDb(value.sale_price_kopiyky),
      cost_price: amountKopiykyToDb(value.cost_price_kopiyky),
      direct_expenses: amountKopiykyToDb(value.direct_expenses_kopiyky),
      color_text: emptyToNull(value.color_text),
      size_text: emptyToNull(value.size_text),
      note: emptyToNull(value.note),
      executor_id: value.executor_id,
      sold_on: value.sold_on,
    })
    .eq("id", saleId)
    .eq("workspace_id", gate.workspaceId)
    .eq("status", "open")
    .eq("version", expectedVersion)
    .select(SALE_SELECT)
    .maybeSingle();

  if (error) {
    return fail(
      "error",
      "Не вдалося зберегти зміни. Перевірте з’єднання і спробуйте ще раз.",
    );
  }

  if (!data) {
    const { data: current } = await gate.supabase
      .from("sales")
      .select("id, version, status")
      .eq("id", saleId)
      .eq("workspace_id", gate.workspaceId)
      .maybeSingle();

    if (!current) {
      return fail("not_found", "Продаж не знайдено або недоступний.");
    }
    if (current.status !== "open") {
      return fail(
        "conflict",
        "Продаж уже не відкритий. Оновіть сторінку.",
      );
    }
    const outcome = resolveOptimisticUpdate({
      updated: null,
      current: { id: current.id, version: current.version },
    });
    if (outcome === "conflict") {
      return fail(
        "conflict",
        "Продаж змінено іншим учасником. Оновіть сторінку й застосуйте знову.",
      );
    }
    return fail("not_found", "Продаж не знайдено або недоступний.");
  }

  revalidateSalePaths(data.listing_id, data.id);
  return {
    ok: true,
    code: "ok",
    message: "Збережено.",
    saleId: data.id,
  };
}

export async function completeSaleAction(
  _prev: SaleActionState | null,
  formData: FormData,
): Promise<SaleActionState> {
  const gate = await requireMemberClient(true);
  if (!gate.ok) {
    return gate.state;
  }

  const saleId = formString(formData, "id").trim();
  const expectedVersion = parsePositiveInt(formString(formData, "version"));
  const completedOn =
    parseBusinessDate(formString(formData, "completed_on")) ??
    parseBusinessDate(formString(formData, "sold_on"));
  const completeRequestId = formString(formData, "complete_request_id").trim();

  if (!saleId || expectedVersion === null) {
    return fail("validation", "Некоректні дані для завершення.");
  }
  if (!completedOn) {
    return fail("validation", "Вкажіть дату завершення.");
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      completeRequestId,
    )
  ) {
    return fail("validation", "Некоректний ключ завершення. Оновіть сторінку.");
  }

  const { data, error } = await gate.supabase.rpc("complete_sale", {
    p_sale_id: saleId,
    p_expected_version: expectedVersion,
    p_completed_on: completedOn,
    p_complete_request_id: completeRequestId,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("version conflict")) {
      return fail(
        "conflict",
        "Продаж змінено іншим учасником. Оновіть сторінку й повторіть завершення.",
      );
    }
    if (msg.includes("already completed")) {
      return fail(
        "conflict",
        "Продаж уже завершено. Оновіть сторінку.",
      );
    }
    if (msg.includes("not found")) {
      return fail("not_found", "Продаж не знайдено або недоступний.");
    }
    return fail(
      "error",
      "Не вдалося завершити продаж. Перевірте з’єднання і спробуйте ще раз.",
    );
  }

  const sale = data as Sale | null;
  if (!sale?.id) {
    return fail("error", "Не вдалося завершити продаж.");
  }

  await awardRatingPoints({
    supabase: gate.supabase,
    workspaceId: gate.workspaceId,
    actorId: sale.executor_id || gate.user.id,
    actionKey: "sale_completed",
    entityType: "sales",
    entityId: sale.id,
  });

  revalidateSalePaths(sale.listing_id, sale.id);
  revalidatePath("/app/rating");
  return {
    ok: true,
    code: "ok",
    message: "Продаж завершено. Маржу зафіксовано без реклами.",
    saleId: sale.id,
    idempotentReplay: sale.version === expectedVersion,
  };
}

export async function cancelOpenSaleAction(
  _prev: SaleActionState | null,
  formData: FormData,
): Promise<SaleActionState> {
  const gate = await requireMemberClient(true);
  if (!gate.ok) {
    return gate.state;
  }

  const saleId = formString(formData, "id").trim();
  const expectedVersion = parsePositiveInt(formString(formData, "version"));
  if (!saleId || expectedVersion === null) {
    return fail("validation", "Некоректні дані для скасування.");
  }

  const { data, error } = await gate.supabase.rpc("cancel_open_sale", {
    p_sale_id: saleId,
    p_expected_version: expectedVersion,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("version conflict")) {
      return fail(
        "conflict",
        "Продаж змінено іншим учасником. Оновіть сторінку.",
      );
    }
    return fail("error", "Не вдалося скасувати продаж.");
  }

  const sale = data as Sale | null;
  if (!sale?.id) {
    return fail("error", "Не вдалося скасувати продаж.");
  }

  revalidateSalePaths(sale.listing_id, sale.id);
  return {
    ok: true,
    code: "ok",
    message: "Продаж скасовано.",
    saleId: sale.id,
  };
}

export async function correctCompletedSaleAction(
  _prev: SaleActionState | null,
  formData: FormData,
): Promise<SaleActionState> {
  const gate = await requireMemberClient(true);
  if (!gate.ok) {
    return gate.state;
  }

  const saleId = formString(formData, "id").trim();
  const expectedVersion = parsePositiveInt(formString(formData, "version"));
  if (!saleId || expectedVersion === null) {
    return fail("validation", "Некоректні дані форми (id або version).");
  }

  const validated = validateSaleCorrect({
    sale_price: formString(formData, "sale_price"),
    cost_price: formString(formData, "cost_price"),
    direct_expenses: formString(formData, "direct_expenses"),
    color_text: formString(formData, "color_text"),
    size_text: formString(formData, "size_text"),
    note: formString(formData, "note"),
    executor_id: formString(formData, "executor_id"),
    sold_on: formString(formData, "sold_on"),
    completed_on: formString(formData, "completed_on"),
    correction_reason: formString(formData, "correction_reason"),
  });
  if (!validated.ok) {
    return fail("validation", validated.message);
  }
  const { value } = validated;

  const { data, error } = await gate.supabase.rpc("correct_completed_sale", {
    p_sale_id: saleId,
    p_expected_version: expectedVersion,
    p_sale_price: amountKopiykyToDb(value.sale_price_kopiyky),
    p_cost_price: amountKopiykyToDb(value.cost_price_kopiyky),
    p_direct_expenses: amountKopiykyToDb(value.direct_expenses_kopiyky),
    p_completed_on: value.completed_on,
    p_executor_id: value.executor_id,
    p_color_text: emptyToNull(value.color_text),
    p_size_text: emptyToNull(value.size_text),
    p_note: emptyToNull(value.note),
    p_sold_on: value.sold_on,
    p_correction_reason: value.correction_reason,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("version conflict")) {
      return fail(
        "conflict",
        "Продаж змінено іншим учасником. Оновіть сторінку й повторіть.",
      );
    }
    return fail("error", "Не вдалося зберегти корекцію.");
  }

  const sale = data as Sale | null;
  if (!sale?.id) {
    return fail("error", "Не вдалося зберегти корекцію.");
  }

  revalidateSalePaths(sale.listing_id, sale.id);
  return {
    ok: true,
    code: "ok",
    message: "Корекцію завершеного продажу збережено.",
    saleId: sale.id,
  };
}
