import type { ListingInput, ListingStatus } from "./types";

export const LISTING_LIMITS = {
  titleMax: 200,
  colorsMax: 4000,
  descriptionMax: 8000,
  notesMax: 8000,
  publicationUrlMax: 2000,
} as const;

export type ListingValidationResult =
  | { ok: true; value: ListingInput }
  | { ok: false; message: string };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedPublicationUrl(url: string): boolean {
  if (!url) {
    return true;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/** Pure form validation — used by server actions and spot tests. */
export function validateListingInput(raw: {
  title?: unknown;
  colors_text?: unknown;
  description?: unknown;
  notes?: unknown;
  publication_url?: unknown;
}): ListingValidationResult {
  const title = asTrimmedString(raw.title);
  const colors_text = asTrimmedString(raw.colors_text);
  const description = asTrimmedString(raw.description);
  const notes = asTrimmedString(raw.notes);
  const publication_url = asTrimmedString(raw.publication_url);

  if (!title) {
    return { ok: false, message: "Вкажіть назву моделі." };
  }
  if (title.length > LISTING_LIMITS.titleMax) {
    return {
      ok: false,
      message: `Назва занадто довга (макс. ${LISTING_LIMITS.titleMax} символів).`,
    };
  }
  if (colors_text.length > LISTING_LIMITS.colorsMax) {
    return {
      ok: false,
      message: `Текст кольорів занадто довгий (макс. ${LISTING_LIMITS.colorsMax}).`,
    };
  }
  if (description.length > LISTING_LIMITS.descriptionMax) {
    return {
      ok: false,
      message: `Опис занадто довгий (макс. ${LISTING_LIMITS.descriptionMax}).`,
    };
  }
  if (notes.length > LISTING_LIMITS.notesMax) {
    return {
      ok: false,
      message: `Примітки занадто довгі (макс. ${LISTING_LIMITS.notesMax}).`,
    };
  }
  if (publication_url.length > LISTING_LIMITS.publicationUrlMax) {
    return {
      ok: false,
      message: `Посилання занадто довге (макс. ${LISTING_LIMITS.publicationUrlMax}).`,
    };
  }
  if (!isAllowedPublicationUrl(publication_url)) {
    return {
      ok: false,
      message: "Посилання має починатися з http:// або https://.",
    };
  }

  return {
    ok: true,
    value: {
      title,
      colors_text,
      description,
      notes,
      publication_url,
    },
  };
}

export function parseListingStatus(value: unknown): ListingStatus | null {
  if (value === "active" || value === "archived") {
    return value;
  }
  return null;
}

export function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number.parseInt(value.trim(), 10);
    if (n > 0) {
      return n;
    }
  }
  return null;
}

/** Optional text for DB: empty → null. */
export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
