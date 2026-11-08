import Link from "next/link";

import { listListings } from "@/app/actions/listings";
import { CardSurface } from "@/components/ui/card-surface";
import { Button } from "@/components/ui/button";
import type { Listing } from "@/lib/listings/types";
import { cn } from "cn";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Promise<{ status?: string; q?: string }>;

type FilterKey = "all" | "active" | "archived";

function parseFilter(raw: string | undefined): FilterKey {
  if (raw === "archived") return "archived";
  if (raw === "active") return "active";
  return "all";
}

function statusUa(status: Listing["status"]) {
  return status === "active" ? "Активне" : "Архів";
}

function formatUpdated(iso: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(new Date(iso));
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = parseFilter(params.status);
  const q = (params.q ?? "").trim().toLowerCase();

  const listStatus =
    filter === "active" ? "active" : filter === "archived" ? "archived" : "all";
  const listRes = await listListings(listStatus);

  const loadError = listRes.ok ? null : listRes.message;
  let listings: Listing[] = listRes.ok ? listRes.listings : [];

  if (q) {
    listings = listings.filter((l) => l.title.toLowerCase().includes(q));
  }

  const tabs: { key: FilterKey; label: string; href: string }[] = [
    {
      key: "all",
      label: "Усі",
      href: q ? `/app/listings?q=${encodeURIComponent(q)}` : "/app/listings",
    },
    {
      key: "active",
      label: "Активні",
      href: q
        ? `/app/listings?status=active&q=${encodeURIComponent(q)}`
        : "/app/listings?status=active",
    },
    {
      key: "archived",
      label: "Архів",
      href: q
        ? `/app/listings?status=archived&q=${encodeURIComponent(q)}`
        : "/app/listings?status=archived",
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
          <span className="text-xs text-muted-foreground">Пошук за моделлю</span>
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
                : "Поки немає оголошень."}
            </p>
            {filter !== "archived" ? (
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
            {listings.map((listing) => (
              <li key={listing.id}>
                <Link
                  href={`/app/listings/${listing.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
                >
                  <span
                    className="size-14 shrink-0 rounded-xl bg-secondary"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-base font-medium">
                      {listing.title}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {listing.colors_text?.trim() || "Кольори не вказані"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                      listing.status === "active"
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {statusUa(listing.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <CardSurface className="hidden gap-0 overflow-hidden p-0 md:flex">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Модель</th>
                    <th className="px-4 py-3 font-medium">Кольори</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium">Оновлено</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => (
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
                      <td className="max-w-[16rem] truncate px-4 py-3.5 text-muted-foreground">
                        {listing.colors_text?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            listing.status === "active"
                              ? "bg-primary/15 text-primary"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {statusUa(listing.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-muted-foreground">
                        {formatUpdated(listing.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardSurface>
        </>
      )}
    </section>
  );
}
