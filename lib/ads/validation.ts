import {
  formatKopiykyToUah,
  parseUahToKopiyky,
} from "@/lib/money/kopiyky";

import type {
  AdPaymentCorrectInput,
  AdPaymentCreateInput,
  AdPaymentStatus,
} from "./types";

export const AD_LIMITS = {
  noteMax: 4000,
  correctionReasonMin: 3,
  correctionReasonMax: 2000,
} as const;

export type AdValidationResult<T> =
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

/** Calendar date YYYY-MM-DD (actual payment date, Europe/Kyiv day). */
export function parsePaidOn(raw: unknown): string | null {
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
  // Reasonable business range
  if (y < 2020 || y > 2100) {
    return null;
  }
  return value;
}

export function parseAdPaymentStatus(value: unknown): AdPaymentStatus | null {
  if (value === "valid" || value === "void") {
    return value;
  }
  return null;
}

export function validateAdPaymentCreate(raw: {
  listing_id?: unknown;
  amount?: unknown;
  paid_on?: unknown;
  payer_id?: unknown;
  note?: unknown;
  client_request_id?: unknown;
}): AdValidationResult<AdPaymentCreateInput> {
  const listing_id = asTrimmedString(raw.listing_id);
  const payer_id = asTrimmedString(raw.payer_id);
  const note = asTrimmedString(raw.note);
  const client_request_id = asTrimmedString(raw.client_request_id);
  const paid_on = parsePaidOn(raw.paid_on);
  const amountParsed = parseUahToKopiyky(
    typeof raw.amount === "string" || typeof raw.amount === "number"
      ? raw.amount
      : "",
  );

  if (!isUuid(listing_id)) {
    return { ok: false, message: "Оберіть оголошення." };
  }
  if (!isUuid(payer_id)) {
    return { ok: false, message: "Оберіть платника." };
  }
  if (!isUuid(client_request_id)) {
    return { ok: false, message: "Некоректний ключ запиту. Оновіть сторінку." };
  }
  if (!paid_on) {
    return { ok: false, message: "Вкажіть фактичну дату платежу." };
  }
  if (!amountParsed.ok) {
    return { ok: false, message: amountParsed.message };
  }
  if (amountParsed.kopiyky <= 0) {
    return { ok: false, message: "Сума дійсного платежу має бути більшою за 0." };
  }
  if (note.length > AD_LIMITS.noteMax) {
    return {
      ok: false,
      message: `Примітка занадто довга (макс. ${AD_LIMITS.noteMax}).`,
    };
  }

  return {
    ok: true,
    value: {
      listing_id,
      amount_kopiyky: amountParsed.kopiyky,
      paid_on,
      payer_id,
      note,
      client_request_id,
    },
  };
}

export function validateAdPaymentCorrect(raw: {
  amount?: unknown;
  paid_on?: unknown;
  payer_id?: unknown;
  note?: unknown;
  status?: unknown;
  correction_reason?: unknown;
}): AdValidationResult<AdPaymentCorrectInput> {
  const payer_id = asTrimmedString(raw.payer_id);
  const note = asTrimmedString(raw.note);
  const correction_reason = asTrimmedString(raw.correction_reason);
  const paid_on = parsePaidOn(raw.paid_on);
  const status = parseAdPaymentStatus(raw.status);
  const amountParsed = parseUahToKopiyky(
    typeof raw.amount === "string" || typeof raw.amount === "number"
      ? raw.amount
      : "",
  );

  if (!isUuid(payer_id)) {
    return { ok: false, message: "Оберіть платника." };
  }
  if (!paid_on) {
    return { ok: false, message: "Вкажіть фактичну дату платежу." };
  }
  if (!status) {
    return { ok: false, message: "Оберіть стан платежу (дійсний / анульований)." };
  }
  if (!amountParsed.ok) {
    return { ok: false, message: amountParsed.message };
  }
  if (status === "valid" && amountParsed.kopiyky <= 0) {
    return { ok: false, message: "Сума дійсного платежу має бути більшою за 0." };
  }
  if (correction_reason.length < AD_LIMITS.correctionReasonMin) {
    return {
      ok: false,
      message: "Вкажіть причину виправлення (мінімум 3 символи).",
    };
  }
  if (correction_reason.length > AD_LIMITS.correctionReasonMax) {
    return {
      ok: false,
      message: `Причина занадто довга (макс. ${AD_LIMITS.correctionReasonMax}).`,
    };
  }
  if (note.length > AD_LIMITS.noteMax) {
    return {
      ok: false,
      message: `Примітка занадто довга (макс. ${AD_LIMITS.noteMax}).`,
    };
  }

  return {
    ok: true,
    value: {
      amount_kopiyky: amountParsed.kopiyky,
      paid_on,
      payer_id,
      note,
      status,
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
