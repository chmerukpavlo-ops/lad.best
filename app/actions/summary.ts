"use server";

import { getMemberGate } from "@/lib/auth/member-gate";
import {
  dbAmountToKopiyky,
  dbSignedAmountToKopiyky,
} from "@/lib/money/kopiyky";
import {
  listingLifetime,
  periodSummary,
  type ListingLifetime,
  type PeriodSummary,
} from "@/lib/summary/formulas";
import {
  addCalendarDays,
  dateInPeriod,
  getPeriodBounds,
  kyivTodayYmd,
  parseSummaryPeriod,
  startOfKyivWeek,
  type PeriodBounds,
  type SummaryPeriodKey,
} from "@/lib/summary/period";
import {
  collectTestListingIds,
  hasTestMarker,
} from "@/lib/summary/test-markers";

export type TestDataReport = {
  listingCount: number;
  saleCount: number;
  adPaymentCount: number;
  listingIds: string[];
};

export type WorkspacePeriodReport = {
  ok: boolean;
  message?: string;
  period: PeriodBounds;
  summary: PeriodSummary;
  /** Excluded from totals — do not treat as live business. */
  testData: TestDataReport;
  recent: Array<{
    kind: "sale" | "ad";
    text: string;
    when: string;
  }>;
  weekBars: Array<{ day: string; height: number; highlight?: boolean }>;
};

export type ListingLifetimeReport = {
  ok: boolean;
  message?: string;
  lifetime: ListingLifetime;
  excludedAsTest: boolean;
};

async function requireMember() {
  const gate = await getMemberGate(false);
  if (!gate.ok) {
    return { ok: false as const, message: gate.message };
  }
  return {
    ok: true as const,
    supabase: gate.supabase,
    workspaceId: gate.workspaceId,
  };
}

export async function getTestDataReport(): Promise<TestDataReport> {
  const gate = await requireMember();
  if (!gate.ok) {
    return {
      listingCount: 0,
      saleCount: 0,
      adPaymentCount: 0,
      listingIds: [],
    };
  }

  const [{ data: listings }, { data: sales }, { data: ads }] = await Promise.all([
    gate.supabase
      .from("listings")
      .select("id, title, notes")
      .eq("workspace_id", gate.workspaceId),
    gate.supabase
      .from("sales")
      .select("id, note, listing_id")
      .eq("workspace_id", gate.workspaceId),
    gate.supabase
      .from("ad_payments")
      .select("id, note, listing_id")
      .eq("workspace_id", gate.workspaceId),
  ]);

  const testListings = collectTestListingIds(listings ?? []);
  const listingIds = [...testListings];

  const saleCount = (sales ?? []).filter(
    (s) => hasTestMarker(s.note) || testListings.has(s.listing_id),
  ).length;
  const adPaymentCount = (ads ?? []).filter(
    (a) => hasTestMarker(a.note) || testListings.has(a.listing_id),
  ).length;

  return {
    listingCount: listingIds.length,
    saleCount,
    adPaymentCount,
    listingIds,
  };
}

export async function getWorkspacePeriodReport(
  periodKey?: string | null,
): Promise<WorkspacePeriodReport> {
  const key: SummaryPeriodKey = parseSummaryPeriod(periodKey ?? undefined);
  const period = getPeriodBounds(key);
  const empty: PeriodSummary = {
    completedCount: 0,
    revenueKopiyky: 0,
    marginKopiyky: 0,
    adsKopiyky: 0,
    resultKopiyky: 0,
  };

  const gate = await requireMember();
  if (!gate.ok) {
    return {
      ok: false,
      message: gate.message,
      period,
      summary: empty,
      testData: {
        listingCount: 0,
        saleCount: 0,
        adPaymentCount: 0,
        listingIds: [],
      },
      recent: [],
      weekBars: [],
    };
  }

  const [{ data: listings }, { data: sales }, { data: ads }] = await Promise.all([
    gate.supabase
      .from("listings")
      .select("id, title, notes")
      .eq("workspace_id", gate.workspaceId),
    gate.supabase
      .from("sales")
      .select(
        "id, listing_id, sale_price, margin, status, completed_on, note, sold_on, listings(title)",
      )
      .eq("workspace_id", gate.workspaceId)
      .eq("status", "completed"),
    gate.supabase
      .from("ad_payments")
      .select("id, listing_id, amount, status, paid_on, note, listings(title)")
      .eq("workspace_id", gate.workspaceId)
      .eq("status", "valid"),
  ]);

  const testListings = collectTestListingIds(listings ?? []);

  const liveSales = (sales ?? []).filter((s) => {
    if (testListings.has(s.listing_id)) return false;
    if (hasTestMarker(s.note)) return false;
    return true;
  });
  const liveAds = (ads ?? []).filter((a) => {
    if (testListings.has(a.listing_id)) return false;
    if (hasTestMarker(a.note)) return false;
    return true;
  });

  const periodSales = liveSales.filter(
    (s) =>
      typeof s.completed_on === "string" &&
      dateInPeriod(s.completed_on, period.startDate, period.endDate),
  );
  const periodAds = liveAds.filter(
    (a) =>
      typeof a.paid_on === "string" &&
      dateInPeriod(a.paid_on, period.startDate, period.endDate),
  );

  const summary = periodSummary({
    completedSalePrices: periodSales.map((s) =>
      dbAmountToKopiyky(s.sale_price),
    ),
    completedMargins: periodSales.map((s) =>
      dbSignedAmountToKopiyky(s.margin),
    ),
    validAdAmounts: periodAds.map((a) => dbAmountToKopiyky(a.amount)),
  });

  const testSales = (sales ?? []).filter(
    (s) => testListings.has(s.listing_id) || hasTestMarker(s.note),
  );
  const testAds = (ads ?? []).filter(
    (a) => testListings.has(a.listing_id) || hasTestMarker(a.note),
  );

  const recent = [
    ...periodSales.slice(0, 5).map((s) => {
      const listing = Array.isArray(s.listings) ? s.listings[0] : s.listings;
      return {
        kind: "sale" as const,
        text: `Завершено: ${listing?.title ?? "оголошення"}`,
        when: s.completed_on as string,
      };
    }),
    ...periodAds.slice(0, 5).map((a) => {
      const listing = Array.isArray(a.listings) ? a.listings[0] : a.listings;
      return {
        kind: "ad" as const,
        text: `Реклама: ${listing?.title ?? "оголошення"}`,
        when: a.paid_on as string,
      };
    }),
  ]
    .sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0))
    .slice(0, 6);

  const weekBars = buildWeekBars(liveSales, kyivTodayYmd());

  return {
    ok: true,
    period,
    summary,
    testData: {
      listingCount: testListings.size,
      saleCount: testSales.length,
      adPaymentCount: testAds.length,
      listingIds: [...testListings],
    },
    recent,
    weekBars,
  };
}

function buildWeekBars(
  liveCompletedSales: Array<{ margin: unknown; completed_on: unknown }>,
  todayYmd: string,
): Array<{ day: string; height: number; highlight?: boolean }> {
  const labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  const weekStart = startOfKyivWeek(todayYmd);
  const dayMargins: number[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addCalendarDays(weekStart, i);
    let sum = 0;
    for (const s of liveCompletedSales) {
      if (s.completed_on === day && s.margin != null) {
        sum += dbSignedAmountToKopiyky(s.margin);
      }
    }
    dayMargins.push(sum);
  }
  const max = Math.max(...dayMargins.map((v) => Math.abs(v)), 1);
  return dayMargins.map((m, i) => ({
    day: labels[i]!,
    height: Math.max(8, Math.round((Math.abs(m) / max) * 88)),
    highlight: i === 6,
  }));
}

export async function getListingLifetimeReport(
  listingId: string,
): Promise<ListingLifetimeReport> {
  const gate = await requireMember();
  if (!gate.ok) {
    return {
      ok: false,
      message: gate.message,
      lifetime: {
        marginKopiyky: 0,
        adsKopiyky: 0,
        resultKopiyky: 0,
        uncoveredAdsKopiyky: 0,
      },
      excludedAsTest: false,
    };
  }

  const { data: listing } = await gate.supabase
    .from("listings")
    .select("id, title, notes")
    .eq("id", listingId)
    .eq("workspace_id", gate.workspaceId)
    .maybeSingle();

  if (!listing) {
    return {
      ok: false,
      message: "Оголошення не знайдено.",
      lifetime: {
        marginKopiyky: 0,
        adsKopiyky: 0,
        resultKopiyky: 0,
        uncoveredAdsKopiyky: 0,
      },
      excludedAsTest: false,
    };
  }

  const excludedAsTest =
    hasTestMarker(listing.title) || hasTestMarker(listing.notes);

  const [{ data: sales }, { data: ads }] = await Promise.all([
    gate.supabase
      .from("sales")
      .select("margin, note")
      .eq("workspace_id", gate.workspaceId)
      .eq("listing_id", listingId)
      .eq("status", "completed"),
    gate.supabase
      .from("ad_payments")
      .select("amount, note")
      .eq("workspace_id", gate.workspaceId)
      .eq("listing_id", listingId)
      .eq("status", "valid"),
  ]);

  // Lifetime on listing page always shows this listing's finances (incl. test if viewing test listing).
  // When viewing a normal listing, still skip rows marked [TEST] by note.
  const margins = (sales ?? [])
    .filter((s) => excludedAsTest || !hasTestMarker(s.note))
    .map((s) => dbSignedAmountToKopiyky(s.margin));
  const adAmounts = (ads ?? [])
    .filter((a) => excludedAsTest || !hasTestMarker(a.note))
    .map((a) => dbAmountToKopiyky(a.amount));

  return {
    ok: true,
    lifetime: listingLifetime(margins, adAmounts),
    excludedAsTest,
  };
}
