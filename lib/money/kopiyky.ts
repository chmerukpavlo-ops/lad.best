/**
 * Exact UAH money helpers — integer kopiyky only (no float arithmetic).
 * 1 UAH = 100 kopiyky.
 */

export const MONEY_LIMITS = {
  /** numeric(12,2) max in kopiyky */
  maxKopiyky: 999_999_999_999,
  minKopiyky: 0,
} as const;

export type MoneyParseResult =
  | { ok: true; kopiyky: number }
  | { ok: false; message: string };

/** Parse user/DB decimal string into non-negative kopiyky. */
export function parseUahToKopiyky(raw: unknown): MoneyParseResult {
  if (typeof raw !== "string" && typeof raw !== "number") {
    return { ok: false, message: "Вкажіть суму." };
  }

  const trimmed =
    typeof raw === "number"
      ? Number.isFinite(raw)
        ? raw.toFixed(2)
        : ""
      : raw.trim().replace(",", ".");

  if (!trimmed) {
    return { ok: false, message: "Вкажіть суму." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return {
      ok: false,
      message: "Сума у форматі 0 або 0.00 (до двох знаків після коми).",
    };
  }

  const [wholePart, fracPart = ""] = trimmed.split(".");
  const whole = Number.parseInt(wholePart, 10);
  const frac = Number.parseInt(fracPart.padEnd(2, "0") || "0", 10);
  if (!Number.isFinite(whole) || !Number.isFinite(frac)) {
    return { ok: false, message: "Некоректна сума." };
  }

  return validateKopiyky(whole * 100 + frac);
}

function validateKopiyky(kopiyky: number): MoneyParseResult {
  if (!Number.isInteger(kopiyky) || kopiyky < MONEY_LIMITS.minKopiyky) {
    return { ok: false, message: "Сума має бути невід’ємною." };
  }
  if (kopiyky > MONEY_LIMITS.maxKopiyky) {
    return { ok: false, message: "Сума занадто велика." };
  }
  return { ok: true, kopiyky };
}

/** Format kopiyky as fixed 2-decimal UAH string for DB/UI. */
export function formatKopiykyToUah(kopiyky: number): string {
  if (!Number.isInteger(kopiyky)) {
    throw new Error("kopiyky must be an integer");
  }
  const sign = kopiyky < 0 ? "-" : "";
  const abs = Math.abs(kopiyky);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}.${String(frac).padStart(2, "0")}`;
}

/** Display with thin space thousands separator (UA). */
export function formatUahDisplay(kopiyky: number): string {
  const fixed = formatKopiykyToUah(kopiyky);
  const [whole, frac] = fixed.replace("-", "").split(".");
  const withSpaces = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  const sign = kopiyky < 0 ? "−" : "";
  return `${sign}${withSpaces},${frac}\u00a0₴`;
}

/** Sum kopiyky exactly (integer). */
export function sumKopiyky(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    if (!Number.isInteger(v)) {
      throw new Error("sumKopiyky expects integers");
    }
    total += v;
  }
  return total;
}

/** Convert DB numeric string/number to kopiyky. */
export function dbAmountToKopiyky(raw: unknown): number {
  const parsed = parseUahToKopiyky(
    typeof raw === "number" && Number.isFinite(raw) ? raw.toFixed(2) : raw,
  );
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.kopiyky;
}

/**
 * Margin may be negative. Parse signed UAH into integer kopiyky.
 * Still exact string→integer path (no float arithmetic on money).
 */
export function parseSignedUahToKopiyky(raw: unknown): MoneyParseResult {
  if (typeof raw !== "string" && typeof raw !== "number") {
    return { ok: false, message: "Вкажіть суму." };
  }
  const trimmed =
    typeof raw === "number"
      ? Number.isFinite(raw)
        ? raw.toFixed(2)
        : ""
      : raw.trim().replace(",", ".");
  if (!trimmed) {
    return { ok: false, message: "Вкажіть суму." };
  }
  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const parsed = parseUahToKopiyky(abs);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, kopiyky: negative ? -parsed.kopiyky : parsed.kopiyky };
}

export function dbSignedAmountToKopiyky(raw: unknown): number {
  const parsed = parseSignedUahToKopiyky(
    typeof raw === "number" && Number.isFinite(raw) ? raw.toFixed(2) : raw,
  );
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.kopiyky;
}

/** M_s = P − C − E in kopiyky (may be negative). */
export function computeMarginKopiyky(
  salePrice: number,
  costPrice: number,
  directExpenses: number,
): number {
  if (
    !Number.isInteger(salePrice) ||
    !Number.isInteger(costPrice) ||
    !Number.isInteger(directExpenses)
  ) {
    throw new Error("margin inputs must be integer kopiyky");
  }
  return salePrice - costPrice - directExpenses;
}
