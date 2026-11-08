export const DEFAULT_RATING_WEIGHTS = {
  listing_create: 2,
  listing_update: 1,
  listing_description: 2,
  ad_review: 1,
  ad_payment: 1,
  buyer_reply: 0,
  order_received: 2,
  sale_completed: 3,
} as const;

export type RatingActionKey = keyof typeof DEFAULT_RATING_WEIGHTS;

export const RATING_ACTION_LABELS: Record<RatingActionKey, string> = {
  listing_create: "Створення оголошення",
  listing_update: "Оновлення оголошення",
  listing_description: "Написання опису",
  ad_review: "Перевірка реклами",
  ad_payment: "Оплата реклами",
  buyer_reply: "Відповідь покупцю",
  order_received: "Отримане замовлення",
  sale_completed: "Успішний продаж",
};

export type FinanceSettings = {
  workspace_id: string;
  split_enabled: boolean;
  member_a_id: string;
  member_b_id: string;
  percent_a: number;
  percent_b: number;
  version: number;
};

export type RatingSettings = {
  workspace_id: string;
  rating_enabled: boolean;
  weights: Record<string, number>;
  version: number;
};

export function parseWeight(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 100) {
    return raw;
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = Number.parseInt(raw.trim(), 10);
    if (n >= 0 && n <= 100) return n;
  }
  return null;
}

export function normalizeWeights(
  input: Record<string, unknown> | null | undefined,
): Record<RatingActionKey, number> {
  const out: Record<RatingActionKey, number> = { ...DEFAULT_RATING_WEIGHTS };
  if (!input) return out;
  for (const key of Object.keys(DEFAULT_RATING_WEIGHTS) as RatingActionKey[]) {
    const parsed = parseWeight(input[key]);
    if (parsed != null) out[key] = parsed;
  }
  return out;
}
