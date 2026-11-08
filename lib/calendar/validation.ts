import { parseKyivDateTimeLocal } from "./kyiv";
import type { AvailabilityKind } from "./types";

export type EventInput = {
  participant_id: string;
  kind: AvailabilityKind;
  starts_at_iso: string;
  ends_at_iso: string;
  note: string;
};

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parseKind(raw: unknown): AvailabilityKind | null {
  if (raw === "busy" || raw === "free") return raw;
  return null;
}

export function validateEventInput(raw: {
  participant_id?: unknown;
  kind?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  note?: unknown;
}): { ok: true; value: EventInput } | { ok: false; message: string } {
  const participant_id = asTrimmed(raw.participant_id);
  const kind = parseKind(raw.kind);
  const note = asTrimmed(raw.note);
  const startsRaw = asTrimmed(raw.starts_at);
  const endsRaw = asTrimmed(raw.ends_at);

  if (!isUuid(participant_id)) {
    return { ok: false, message: "Оберіть учасника." };
  }
  if (!kind) {
    return { ok: false, message: "Оберіть тип: зайнятий або вільний." };
  }
  const startMs = parseKyivDateTimeLocal(startsRaw);
  const endMs = parseKyivDateTimeLocal(endsRaw);
  if (startMs == null || endMs == null) {
    return {
      ok: false,
      message: "Дати/час у форматі РРРР-ММ-ДДTГГ:ХХ (Europe/Kyiv).",
    };
  }
  if (endMs <= startMs) {
    return { ok: false, message: "Кінець має бути пізніше за початок." };
  }
  if (endMs - startMs > 48 * 60 * 60 * 1000) {
    return { ok: false, message: "Інтервал занадто довгий (макс. 48 год)." };
  }
  if (note.length > 2000) {
    return { ok: false, message: "Примітка занадто довга." };
  }

  return {
    ok: true,
    value: {
      participant_id,
      kind,
      starts_at_iso: new Date(startMs).toISOString(),
      ends_at_iso: new Date(endMs).toISOString(),
      note,
    },
  };
}

export function emptyToNull(value: string): string | null {
  const t = value.trim();
  return t ? t : null;
}
