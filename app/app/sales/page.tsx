import Link from "next/link";

import { listSales } from "@/app/actions/sales";
import { getWorkspacePeriodReport } from "@/app/actions/summary";
import { CardSurface } from "@/components/ui/card-surface";
import { Button } from "@/components/ui/button";
import {
  dbAmountToKopiyky,
  dbSignedAmountToKopiyky,
  formatUahDisplay,
} from "@/lib/money/kopiyky";
import { cn } from "cn";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Promise<{ status?: string }>;

function statusLabel(status: string): string {
  if (status === "completed") return "Завершено";
  if (status === "cancelled") return "Скасовано";
  return "Відкритий";
}

function statusTone(status: string) {
  if (status === "completed") return "ok";
  if (status === "cancelled") return "muted";
  return "warn";
}

function formatSoldOn(ymd: string) {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}.${m}`;
}

function salesCountUa(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${n} продажів`;
  if (last === 1) return `${n} продаж`;
  if (last >= 2 && last <= 4) return `${n} продажі`;
  return `${n} продажів`;
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const statusFilter =
    params.status === "completed" ||
    params.status === "cancelled" ||
    params.status === "open"
      ? params.status
      : undefined;

  const [result, todayReport, weekReport, monthReport] = await Promise.all([
    listSales(statusFilter),
    getWorkspacePeriodReport("today"),
    getWorkspacePeriodReport("week"),
    getWorkspacePeriodReport("month"),
  ]);

  const profitCards = [
    {
      key: "today" as const,
      title: "Прибуток за сьогодні",
      report: todayReport,
    },
    {
      key: "week" as const,
      title: "Прибуток за тиждень",
      report: weekReport,
    },
    {
      key: "month" as const,
      title: "Прибуток за місяць",
      report: monthReport,
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Продажі</h1>
        <Button
          asChild
          size="lg"
          className="hidden min-h-11 min-w-[11rem] rounded-xl text-base md:inline-flex"
        >
          <Link href="/app/sales/new">Новий продаж</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {profitCards.map((card) => {
          const profit = card.report.ok
            ? formatUahDisplay(card.report.summary.resultKopiyky)
            : "—";
          const count = card.report.ok
            ? card.report.summary.completedCount
            : 0;
          return (
            <Link
              key={card.key}
              href={`/app/statistics?period=${card.key}`}
              className="block rounded-2xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <CardSurface className="h-full gap-1.5 p-4">
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-[1.65rem] font-bold tabular-nums tracking-tight">
                  {profit}
                </p>
                <p className="text-xs text-muted-foreground">
                  {card.report.ok ? salesCountUa(count) : "—"}
                </p>
              </CardSurface>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { href: "/app/sales", key: undefined, label: "Усі" },
            { href: "/app/sales?status=open", key: "open", label: "Відкриті" },
            {
              href: "/app/sales?status=completed",
              key: "completed",
              label: "Завершені",
            },
            {
              href: "/app/sales?status=cancelled",
              key: "cancelled",
              label: "Скасовані",
            },
          ] as const
        ).map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
              statusFilter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!result.ok ? (
        <CardSurface className="text-sm text-destructive">
          {result.message}
        </CardSurface>
      ) : result.sales.length === 0 ? (
        <CardSurface className="border-dashed text-sm text-muted-foreground">
          <div className="flex flex-col gap-4">
            <p>Поки немає продажів у цьому фільтрі.</p>
            <Button
              asChild
              size="lg"
              className="min-h-11 w-full rounded-xl text-base sm:w-auto"
            >
              <Link href="/app/sales/new">Створити продаж</Link>
            </Button>
          </div>
        </CardSurface>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5 md:hidden">
            {result.sales.map((sale) => {
              let marginLabel = "—";
              if (sale.margin != null) {
                try {
                  marginLabel = formatUahDisplay(
                    dbSignedAmountToKopiyky(sale.margin),
                  );
                } catch {
                  marginLabel = `${sale.margin} ₴`;
                }
              }
              const tone = statusTone(sale.status);
              const title = [sale.listing_title, sale.size_text]
                .filter(Boolean)
                .join(", ");

              return (
                <li key={sale.id}>
                  <Link
                    href={`/app/sales/${sale.id}`}
                    className="block rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-base font-medium">
                          {title}
                        </p>
                        <p className="text-sm tabular-nums text-muted-foreground">
                          {formatSoldOn(sale.sold_on)} · {marginLabel}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                          tone === "ok"
                            ? "bg-primary/15 text-primary"
                            : tone === "warn"
                              ? "bg-[#3a2e1a] text-[#f0b429]"
                              : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {statusLabel(sale.status)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <CardSurface className="hidden gap-0 overflow-hidden p-0 md:flex">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Модель</th>
                    <th className="px-4 py-3 font-medium">Дата</th>
                    <th className="px-4 py-3 font-medium">Прибуток</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sales.map((sale) => {
                    let marginLabel = "—";
                    if (sale.margin != null) {
                      try {
                        marginLabel = formatUahDisplay(
                          dbSignedAmountToKopiyky(sale.margin),
                        );
                      } catch {
                        marginLabel = `${sale.margin} ₴`;
                      }
                    } else {
                      try {
                        marginLabel = formatUahDisplay(
                          dbAmountToKopiyky(sale.sale_price),
                        );
                      } catch {
                        marginLabel = sale.sale_price;
                      }
                    }
                    const tone = statusTone(sale.status);
                    const title = [sale.listing_title, sale.size_text]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <tr
                        key={sale.id}
                        className="border-b border-border/70 last:border-0"
                      >
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/app/sales/${sale.id}`}
                            className="font-medium text-foreground hover:text-primary"
                          >
                            {title}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-muted-foreground">
                          {formatSoldOn(sale.sold_on)}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums">
                          {sale.margin != null ? marginLabel : "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                              tone === "ok"
                                ? "bg-primary/15 text-primary"
                                : tone === "warn"
                                  ? "bg-[#3a2e1a] text-[#f0b429]"
                                  : "bg-secondary text-muted-foreground",
                            )}
                          >
                            {statusLabel(sale.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardSurface>
        </>
      )}
    </section>
  );
}
