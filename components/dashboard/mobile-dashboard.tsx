import Link from "next/link";

import type { SharedWindowPreview } from "@/app/actions/calendar";
import type { WorkspacePeriodReport } from "@/app/actions/summary";
import { CardSurface } from "@/components/ui/card-surface";
import { formatUahDisplay } from "@/lib/money/kopiyky";
import type { SummaryPeriodKey } from "@/lib/summary/period";
import { cn } from "cn";

export function MobileDashboard({
  report,
  periodKey: _periodKey,
  availability,
}: {
  report: WorkspacePeriodReport;
  periodKey: SummaryPeriodKey;
  availability: SharedWindowPreview;
}) {
  void _periodKey;
  const s = report.summary;
  const stats = [
    {
      label: "Оборот",
      value: formatUahDisplay(s.revenueKopiyky),
      accent: false,
    },
    {
      label: "Прибуток",
      value: formatUahDisplay(s.resultKopiyky),
      accent: true,
    },
    {
      label: "Реклама",
      value: formatUahDisplay(s.adsKopiyky),
      accent: false,
    },
    {
      label: "Продажі",
      value: String(s.completedCount),
      accent: false,
    },
  ];

  return (
    <div className="flex flex-col gap-3.5 md:hidden">
      <h1 className="text-[1.75rem] font-semibold tracking-tight">
        {report.period.label}
      </h1>

      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((stat) => (
          <CardSurface key={stat.label} className="gap-1 p-3.5">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p
              className={cn(
                "text-[1.35rem] font-bold tabular-nums tracking-tight",
                stat.accent ? "text-primary" : "text-foreground",
              )}
            >
              {stat.value}
            </p>
          </CardSurface>
        ))}
      </div>

      <CardSurface className="gap-1.5 p-4">
        <p className="text-sm text-muted-foreground">Найближче спільне вікно</p>
        <p className="text-[1.65rem] font-semibold tabular-nums tracking-tight text-primary">
          {availability.rangeText ?? "—"}
        </p>
        <p className="text-sm text-muted-foreground">
          {availability.rangeText
            ? "Ти вільний · Партнер вільний"
            : availability.detail}
        </p>
      </CardSurface>

      <CardSurface className="gap-0 p-0">
        <div className="border-b border-border/80 px-4 py-3.5">
          <h2 className="text-base font-medium">Остання активність</h2>
        </div>
        {report.recent.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">
            Порожньо.{" "}
            <Link href="/app/sales/new" className="text-primary">
              Новий продаж
            </Link>
          </p>
        ) : (
          <ul>
            {report.recent.slice(0, 2).map((item, index) => (
              <li
                key={`${item.kind}-${item.text}-${item.when}`}
                className={
                  index === Math.min(report.recent.length, 2) - 1
                    ? "flex items-start justify-between gap-3 px-4 py-3.5"
                    : "flex items-start justify-between gap-3 border-b border-border/80 px-4 py-3.5"
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
