import {
  formatKopiykyToUah,
  parseUahToKopiyky,
} from "@/lib/money/kopiyky";

import type {
  SaleCorrectInput,
  SaleCreateInput,
  SaleStatus,
  SaleUpdateInput,
} from "./types";

export const SALE_LIMITS = {
  colorMax: 200,
  sizeMax: 100,
  noteMax: 4000,
  correctionReasonMin: 3,
  correctionReasonMax: 2000,
} as const;

export type SaleValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parseBusinessDate(raw: unknown): string | null {
  const value = asTrimmedString(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [y, m, d] = value.split("-").map((p) => Number.parseInt(p, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  if (y < 2020 || y > 2100) {
    return null;
  }
  return value;
}

export function parseSaleStatus(value: unknown): SaleStatus | null {
  if (value === "open" || value === "completed" || value === "cancelled") {
    return value;
  }
  return null;
}

function parseMoneyField(
  raw: unknown,
  label: string,
): SaleValidationResult<number> {
  const parsed = parseUahToKopiyky(
    typeof raw === "string" || typeof raw === "number" ? raw : "",
  );
  if (!parsed.ok) {
    return { ok: false, message: `${label}: ${parsed.message}` };
  }
  return { ok: true, value: parsed.kopiyky };
}

function validateCommonFields(raw: {
  sale_price?: unknown;
  cost_price?: unknown;
  direct_expenses?: unknown;
  color_text?: unknown;
  size_text?: unknown;
  note?: unknown;
  executor_id?: unknown;
  sold_on?: unknown;
}): SaleValidationResult<{
  sale_price_kopiyky: number;
  cost_price_kopiyky: number;
  direct_expenses_kopiyky: number;
  color_text: string;
  size_text: string;
  note: string;
  executor_id: string;
  sold_on: string;
}> {
  const executor_id = asTrimmedString(raw.executor_id);
  const color_text = asTrimmedString(raw.color_text);
  const size_text = asTrimmedString(raw.size_text);
  const note = asTrimmedString(raw.note);
  const sold_on = parseBusinessDate(raw.sold_on);

  if (!isUuid(executor_id)) {
    return { ok: false, message: "Оберіть виконавця." };
  }
  if (!sold_on) {
    return { ok: false, message: "Вкажіть бізнес-дату продажу." };
  }

  const salePrice = parseMoneyField(raw.sale_price, "Ціна продажу");
  if (!salePrice.ok) return salePrice;
  const costPrice = parseMoneyField(raw.cost_price, "Закупівля");
  if (!costPrice.ok) return costPrice;

  const expensesRaw =
    typeof raw.direct_expenses === "string" && raw.direct_expenses.trim() === ""
      ? "0"
      : raw.direct_expenses;
  const expenses = parseMoneyField(expensesRaw ?? "0", "Прямі витрати");
  if (!expenses.ok) return expenses;

  if (color_text.length > SALE_LIMITS.colorMax) {
    return {
      ok: false,
      message: `Колір занадто довгий (макс. ${SALE_LIMITS.colorMax}).`,
    };
  }
  if (size_text.length > SALE_LIMITS.sizeMax) {
    return {
      ok: false,
      message: `Розмір занадто довгий (макс. ${SALE_LIMITS.sizeMax}).`,
    };
  }
  if (note.length > SALE_LIMITS.noteMax) {
    return {
      ok: false,
      message: `Примітка занадто довга (макс. ${SALE_LIMITS.noteMax}).`,
    };
  }

  return {
    ok: true,
    value: {
      sale_price_kopiyky: salePrice.value,
      cost_price_kopiyky: costPrice.value,
      direct_expenses_kopiyky: expenses.value,
      color_text,
      size_text,
      note,
      executor_id,
      sold_on,
    },
  };
}

export function validateSaleCreate(raw: {
  listing_id?: unknown;
  sale_price?: unknown;
  cost_price?: unknown;
  direct_expenses?: unknown;
  color_text?: unknown;
  size_text?: unknown;
  note?: unknown;
  executor_id?: unknown;
  sold_on?: unknown;
  client_request_id?: unknown;
}): SaleValidationResult<SaleCreateInput> {
  const listing_id = asTrimmedString(raw.listing_id);
  const client_request_id = asTrimmedString(raw.client_request_id);
  if (!isUuid(listing_id)) {
    return { ok: false, message: "Оберіть оголошення." };
  }
  if (!isUuid(client_request_id)) {
    return { ok: false, message: "Некоректний ключ запиту. Оновіть сторінку." };
  }
  const common = validateCommonFields(raw);
  if (!common.ok) return common;
  return {
    ok: true,
    value: {
      listing_id,
      client_request_id,
      ...common.value,
    },
  };
}

export function validateSaleUpdate(
  raw: Parameters<typeof validateCommonFields>[0],
): SaleValidationResult<SaleUpdateInput> {
  return validateCommonFields(raw);
}

export function validateSaleCorrect(raw: {
  sale_price?: unknown;
  cost_price?: unknown;
  direct_expenses?: unknown;
  color_text?: unknown;
  size_text?: unknown;
  note?: unknown;
  executor_id?: unknown;
  sold_on?: unknown;
  completed_on?: unknown;
  correction_reason?: unknown;
}): SaleValidationResult<SaleCorrectInput> {
  const common = validateCommonFields(raw);
  if (!common.ok) return common;
  const completed_on = parseBusinessDate(raw.completed_on);
  const correction_reason = asTrimmedString(raw.correction_reason);
  if (!completed_on) {
    return { ok: false, message: "Вкажіть дату завершення." };
  }
  if (correction_reason.length < SALE_LIMITS.correctionReasonMin) {
    return {
      ok: false,
      message: "Вкажіть причину виправлення (мінімум 3 символи).",
    };
  }
  if (correction_reason.length > SALE_LIMITS.correctionReasonMax) {
    return {
      ok: false,
      message: `Причина занадто довга (макс. ${SALE_LIMITS.correctionReasonMax}).`,
    };
  }
  return {
    ok: true,
    value: {
      ...common.value,
      completed_on,
      correction_reason,
    },
  };
}

export function amountKopiykyToDb(kopiyky: number): string {
  return formatKopiykyToUah(kopiyky);
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
