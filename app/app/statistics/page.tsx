import Link from "next/link";

import { getWorkspacePeriodReport } from "@/app/actions/summary";
import { PeriodPills } from "@/components/dashboard/period-pills";
import { WeekChart } from "@/components/dashboard/week-chart";
import { CardSurface } from "@/components/ui/card-surface";
import { formatUahDisplay } from "@/lib/money/kopiyky";
import { parseSummaryPeriod } from "@/lib/summary/period";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Promise<{ period?: string }>;

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const periodKey = parseSummaryPeriod(params.period);
  const report = await getWorkspacePeriodReport(periodKey);
  const s = report.summary;

  const stats = [
    {
      label: "Оборот",
      value: formatUahDisplay(s.revenueKopiyky),
      hint: `${s.completedCount} завершених`,
    },
    {
      label: "Чистий прибуток",
      value: formatUahDisplay(s.resultKopiyky),
      hint: "маржа − реклама",
    },
    {
      label: "Реклама",
      value: formatUahDisplay(s.adsKopiyky),
      hint: "дійсні платежі",
    },
    {
      label: "Продажі",
      value: String(s.completedCount),
      hint: "за період",
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Статистика</h1>
        <PeriodPills active={periodKey} basePath="/app/statistics" />
      </div>

      {!report.ok ? (
        <CardSurface className="text-sm text-destructive">
          {report.message}
        </CardSurface>
      ) : null}

      {report.testData.listingCount > 0 ? (
        <CardSurface className="border-amber-500/40 text-sm text-amber-200">
          Частину тестових записів виключено з підсумку.
        </CardSurface>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        {stats.map((stat) => (
          <CardSurface key={stat.label} className="gap-1.5 p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-[1.45rem] font-bold tabular-nums tracking-tight md:text-[1.65rem]">
              {stat.value}
            </p>
            <p className="text-sm text-primary">{stat.hint}</p>
          </CardSurface>
        ))}
      </div>

      <CardSurface className="flex flex-col gap-4">
        <h2 className="text-base font-bold">Прибуток за тиждень</h2>
        <WeekChart bars={report.weekBars} />
      </CardSurface>

      <p className="text-sm text-muted-foreground">
        {report.period.label}: [{report.period.startDate}, {report.period.endDate}
        ) Europe/Kyiv. Lifetime на{" "}
        <Link href="/app/listings" className="text-primary underline">
          оголошенні
        </Link>
        .
      </p>
    </section>
  );
}
