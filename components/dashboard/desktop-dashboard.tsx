import Link from "next/link";

import type { SharedWindowPreview } from "@/app/actions/calendar";
import type { WorkspacePeriodReport } from "@/app/actions/summary";
import { AvailabilityCard } from "@/components/calendar/availability-card";
import { PeriodPills } from "@/components/dashboard/period-pills";
import { WeekChart } from "@/components/dashboard/week-chart";
import { CardSurface } from "@/components/ui/card-surface";
import { formatUahDisplay } from "@/lib/money/kopiyky";
import type { SummaryPeriodKey } from "@/lib/summary/period";

export function DesktopDashboard({
  report,
  periodKey,
  availability,
}: {
  report: WorkspacePeriodReport;
  periodKey: SummaryPeriodKey;
  availability: SharedWindowPreview;
}) {
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
    <div className="hidden flex-col gap-4 md:flex">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[2rem] font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <PeriodPills active={periodKey} />
      </div>

      {!report.ok ? (
        <CardSurface className="text-sm text-destructive">
          {report.message}
        </CardSurface>
      ) : null}

      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <CardSurface key={stat.label} className="gap-1.5 p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-[1.65rem] font-bold tabular-nums tracking-tight text-foreground">
              {stat.value}
            </p>
            <p className="text-sm text-primary">{stat.hint}</p>
          </CardSurface>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CardSurface className="flex flex-col gap-4">
          <h2 className="text-base font-bold">Прибуток за тиждень</h2>
          <WeekChart bars={report.weekBars} />
        </CardSurface>
        <CardSurface>
          <AvailabilityCard preview={availability} />
        </CardSurface>
      </div>

      <CardSurface className="gap-0 p-0">
        <div className="border-b border-border/80 px-5 py-4">
          <h2 className="text-base font-bold">Остання активність</h2>
        </div>
        {report.recent.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Поки немає подій.{" "}
            <Link href="/app/sales/new" className="text-primary">
              Новий продаж
            </Link>
          </p>
        ) : (
          <ul>
            {report.recent.map((item, index) => (
              <li
                key={`${item.kind}-${item.text}-${item.when}`}
                className={
                  index === report.recent.length - 1
                    ? "flex items-start justify-between gap-4 px-5 py-3.5"
                    : "flex items-start justify-between gap-4 border-b border-border/80 px-5 py-3.5"
                }
              >
                <span className="text-sm text-foreground">{item.text}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {item.when}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardSurface>
    </div>
  );
}
