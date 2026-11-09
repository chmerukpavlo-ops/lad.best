import Link from "next/link";

import { listListings } from "@/app/actions/listings";
import { CardSurface } from "@/components/ui/card-surface";
import { Button } from "@/components/ui/button";
import {
  listingAdSignal,
  needsAdPromotion,
} from "@/lib/listings/ad-signal";
import type { ListingListItem } from "@/lib/listings/types";
import {
  dbAmountToKopiyky,
  formatUahDisplay,
} from "@/lib/money/kopiyky";
import { kyivTodayYmd } from "@/lib/summary/period";
import { cn } from "cn";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Promise<{ status?: string; q?: string }>;

type FilterKey = "all" | "active" | "archived" | "promote";

function parseFilter(raw: string | undefined): FilterKey {
  if (raw === "archived") return "archived";
  if (raw === "active") return "active";
  if (raw === "promote") return "promote";
  return "all";
}

function priceLabel(raw: string | null): string {
  if (raw == null || raw === "") return "—";
  try {
    return formatUahDisplay(dbAmountToKopiyky(raw));
  } catch {
    return `${raw} ₴`;
  }
}

function statusBadgeClass(kind: string) {
  if (kind === "archived") return "bg-secondary text-muted-foreground";
  if (kind === "fresh") return "bg-primary/15 text-primary";
  if (kind === "due" || kind === "never") {
    return "bg-amber-400/15 text-amber-200";
  }
  return "bg-secondary text-muted-foreground";
}

function withQuery(base: string, q: string) {
  if (!q) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}q=${encodeURIComponent(q)}`;
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = parseFilter(params.status);
  const q = (params.q ?? "").trim().toLowerCase();
  const today = kyivTodayYmd();

  const listStatus =
    filter === "archived"
      ? "archived"
      : filter === "active" || filter === "promote"
        ? "active"
        : "all";

  const listRes = await listListings(listStatus);
  const loadError = listRes.ok ? null : listRes.message;
  let listings: ListingListItem[] = listRes.ok ? listRes.listings : [];

  if (q) {
    listings = listings.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.brand?.toLowerCase().includes(q) ?? false),
    );
  }

  if (filter === "promote") {
    listings = listings.filter((l) =>
      needsAdPromotion(
        listingAdSignal({
          status: l.status,
          lastAdPaidOn: l.last_ad_paid_on,
          todayYmd: today,
        }),
      ),
    );
  }

  const tabs: { key: FilterKey; label: string; href: string }[] = [
    { key: "all", label: "Усі", href: withQuery("/app/listings", q) },
    {
      key: "active",
      label: "Активні",
      href: withQuery("/app/listings?status=active", q),
    },
    {
      key: "promote",
      label: "Пора рекламувати",
      href: withQuery("/app/listings?status=promote", q),
    },
    {
      key: "archived",
      label: "Архів",
      href: withQuery("/app/listings?status=archived", q),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Оголошення</h1>
        <Button
          asChild
          size="lg"
          className="hidden min-h-11 min-w-[11rem] rounded-xl text-base md:inline-flex"
        >
          <Link href="/app/listings/new">Нове оголошення</Link>
        </Button>
      </div>

      <form className="w-full" action="/app/listings" method="get">
        {filter !== "all" ? (
          <input type="hidden" name="status" value={filter} />
        ) : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Пошук за назвою</span>
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Nike, Adidas, New Balance"
            className="min-h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/50"
          />
        </label>
      </form>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {loadError ? (
        <CardSurface className="text-sm text-destructive">{loadError}</CardSurface>
      ) : listings.length === 0 ? (
        <CardSurface className="border-dashed text-sm text-muted-foreground">
          <div className="flex flex-col gap-4">
            <p>
              {filter === "archived"
                ? "Архів порожній."
                : filter === "promote"
                  ? "Немає оголошень, яким пора рекламувати."
                  : "Поки немає оголошень."}
            </p>
            {filter !== "archived" && filter !== "promote" ? (
              <Button
                asChild
                size="lg"
                className="min-h-11 w-full rounded-xl text-base sm:w-auto"
              >
                <Link href="/app/listings/new">Створити оголошення</Link>
              </Button>
            ) : null}
          </div>
        </CardSurface>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5 md:hidden">
            {listings.map((listing) => {
              const signal = listingAdSignal({
                status: listing.status,
                lastAdPaidOn: listing.last_ad_paid_on,
                todayYmd: today,
              });
              return (
                <li key={listing.id}>
                  <Link
                    href={`/app/listings/${listing.id}`}
                    className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-base font-medium">
                          {listing.title}
                        </p>
                        {listing.brand ? (
                          <p className="truncate text-sm text-muted-foreground">
                            {listing.brand}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                          statusBadgeClass(signal.kind),
                        )}
                      >
                        {signal.kind === "archived"
                          ? "Архів"
                          : signal.kind === "fresh"
                            ? "Активне"
                            : "Пора рекламувати"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span className="tabular-nums">
                        {priceLabel(listing.list_price)}
                      </span>
                      <span className="truncate text-xs">{signal.label}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <CardSurface className="hidden gap-0 overflow-hidden p-0 md:flex">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Назва</th>
                    <th className="px-4 py-3 font-medium">Бренд</th>
                    <th className="px-4 py-3 font-medium">Ціна</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => {
                    const signal = listingAdSignal({
                      status: listing.status,
                      lastAdPaidOn: listing.last_ad_paid_on,
                      todayYmd: today,
                    });
                    return (
                      <tr
                        key={listing.id}
                        className="border-b border-border/70 last:border-0"
                      >
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/app/listings/${listing.id}`}
                            className="font-medium text-foreground hover:text-primary"
                          >
                            {listing.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">
                          {listing.brand?.trim() || "—"}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-muted-foreground">
                          {priceLabel(listing.list_price)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-flex max-w-[16rem] rounded-full px-2.5 py-1 text-xs font-medium",
                              statusBadgeClass(signal.kind),
                            )}
                            title={signal.label}
                          >
                            {signal.label}
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
