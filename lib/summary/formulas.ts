import { sumKopiyky } from "@/lib/money/kopiyky";

/**
 * BUSINESS_RULES §3–4 pure helpers (integer kopiyky).
 * Ads counted once via caller providing unique payment amounts.
 */

export type ListingLifetime = {
  /** M_L */
  marginKopiyky: number;
  /** A_L */
  adsKopiyky: number;
  /** R_L = M_L − A_L (never clamped) */
  resultKopiyky: number;
  /** U_L = max(A_L − M_L, 0) */
  uncoveredAdsKopiyky: number;
};

export type PeriodSummary = {
  completedCount: number;
  revenueKopiyky: number;
  marginKopiyky: number;
  adsKopiyky: number;
  /** margin − ads */
  resultKopiyky: number;
};

export function listingLifetime(
  completedMargins: readonly number[],
  validAdAmounts: readonly number[],
): ListingLifetime {
  const marginKopiyky = sumKopiyky(completedMargins);
  const adsKopiyky = sumKopiyky(validAdAmounts);
  const resultKopiyky = marginKopiyky - adsKopiyky;
  const uncoveredAdsKopiyky = Math.max(adsKopiyky - marginKopiyky, 0);
  return {
    marginKopiyky,
    adsKopiyky,
    resultKopiyky,
    uncoveredAdsKopiyky,
  };
}

export function periodSummary(args: {
  completedSalePrices: readonly number[];
  completedMargins: readonly number[];
  validAdAmounts: readonly number[];
}): PeriodSummary {
  if (args.completedSalePrices.length !== args.completedMargins.length) {
    throw new Error("sale prices and margins length mismatch");
  }
  const revenueKopiyky = sumKopiyky(args.completedSalePrices);
  const marginKopiyky = sumKopiyky(args.completedMargins);
  const adsKopiyky = sumKopiyky(args.validAdAmounts);
  return {
    completedCount: args.completedMargins.length,
    revenueKopiyky,
    marginKopiyky,
    adsKopiyky,
    resultKopiyky: marginKopiyky - adsKopiyky,
  };
}
