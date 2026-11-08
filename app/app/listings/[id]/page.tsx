import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getListing,
  setListingStatus,
  updateListing,
} from "@/app/actions/listings";
import { getListingLifetimeReport } from "@/app/actions/summary";
import { ListingForm } from "@/components/listings/listing-form";
import { ListingStatusForm } from "@/components/listings/listing-status-form";
import { Button } from "@/components/ui/button";
import { CardSurface } from "@/components/ui/card-surface";
import { formatUahDisplay } from "@/lib/money/kopiyky";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getListing(id);

  if (!result.ok || !result.listing) {
    if (result.message?.includes("не знайдено")) {
      notFound();
    }
    return (
      <section className="flex flex-1 flex-col gap-4">
        <CardSurface className="text-sm text-destructive">
          {result.message ?? "Не вдалося відкрити оголошення."}
        </CardSurface>
        <Link href="/app/listings" className="text-sm text-primary underline">
          До списку
        </Link>
      </section>
    );
  }

  const listing = result.listing;
  const isArchived = listing.status === "archived";
  const lifetimeReport = await getListingLifetimeReport(listing.id);
  const life = lifetimeReport.lifetime;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/app/listings" className="hover:text-foreground">
            Оголошення
          </Link>
          <span aria-hidden="true"> / </span>
          {listing.title}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {listing.title}
          </h1>
          <span
            className={
              isArchived
                ? "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                : "rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary"
            }
          >
            {isArchived ? "Архів" : "Активне"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Якщо хтось змінив запис раніше за вас, збереження покаже конфлікт —
          оновіть сторінку й повторіть.
        </p>
      </div>

      <CardSurface className="w-full max-w-lg space-y-3">
        <h2 className="text-base font-medium">Результат за весь час</h2>
        <p className="text-sm text-muted-foreground">
          Маржа завершених продажів мінус дійсна реклама. Архів не стирає ці
          суми.
        </p>
        {lifetimeReport.excludedAsTest ? (
          <p className="text-xs text-amber-200">
            Тестове оголошення — ці цифри не входять у загальний підсумок.
          </p>
        ) : null}
        {lifetimeReport.ok ? (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Маржа завершених</dt>
              <dd className="font-semibold tabular-nums">
                {formatUahDisplay(life.marginKopiyky)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Реклама</dt>
              <dd className="font-semibold tabular-nums">
                {formatUahDisplay(life.adsKopiyky)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Результат</dt>
              <dd className="text-lg font-bold tabular-nums text-primary">
                {formatUahDisplay(life.resultKopiyky)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">До покриття реклами</dt>
              <dd className="font-semibold tabular-nums">
                {formatUahDisplay(life.uncoveredAdsKopiyky)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-destructive">
            {lifetimeReport.message ?? "Не вдалося порахувати результат."}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="secondary" className="min-h-11 rounded-xl">
            <Link href={`/app/ads/new?listing=${listing.id}`}>
              Додати рекламний платіж
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href={`/app/sales/new?listing=${listing.id}`}>
              Новий продаж
            </Link>
          </Button>
        </div>
      </CardSurface>

      <CardSurface className="w-full max-w-lg">
        <ListingForm
          key={`${listing.id}-${listing.version}`}
          mode="edit"
          action={updateListing}
          listingId={listing.id}
          version={listing.version}
          values={listing}
          submitLabel="Зберегти зміни"
        />
      </CardSurface>

      <CardSurface className="w-full max-w-lg space-y-3">
        <h2 className="text-base font-medium">Стан</h2>
        <p className="text-sm text-muted-foreground">
          Архів ховає оголошення з активного списку, але не видаляє запис.
        </p>
        {isArchived ? (
          <ListingStatusForm
            key={`restore-${listing.version}`}
            action={setListingStatus}
            listingId={listing.id}
            version={listing.version}
            nextStatus="active"
            label="Повернути з архіву"
            variant="secondary"
          />
        ) : (
          <ListingStatusForm
            key={`archive-${listing.version}`}
            action={setListingStatus}
            listingId={listing.id}
            version={listing.version}
            nextStatus="archived"
            label="Архівувати"
            variant="outline"
          />
        )}
      </CardSurface>
    </section>
  );
}
