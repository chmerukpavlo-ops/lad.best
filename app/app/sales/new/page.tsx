import Link from "next/link";

import {
  createSale,
  listSalesListings,
  listSalesMembers,
} from "@/app/actions/sales";
import { getOrCreateFinanceSettings } from "@/app/actions/settings";
import { SaleCreateForm } from "@/components/sales/sale-form";
import { CardSurface } from "@/components/ui/card-surface";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Promise<{ listing?: string }>;

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireVerifiedUser();
  const params = await searchParams;
  const [listingsResult, membersResult, financeRes] = await Promise.all([
    listSalesListings(),
    listSalesMembers(),
    getOrCreateFinanceSettings(),
  ]);

  const splitDefaults =
    financeRes.ok && financeRes.settings
      ? {
          enabled: financeRes.settings.split_enabled,
          percentA: financeRes.settings.percent_a,
          percentB: financeRes.settings.percent_b,
          labelA: financeRes.memberLabels.a,
          labelB: financeRes.memberLabels.b,
        }
      : null;

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/app/sales" className="hover:text-foreground">
            Продажі
          </Link>
          <span aria-hidden="true"> / </span>
          Новий
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Новий продаж</h1>
        <p className="text-sm text-muted-foreground">
          Спочатку відкритий запис; завершення — окрема операція зі знімком
          маржі. Повтор запиту не створить дубль.
        </p>
      </div>

      {!listingsResult.ok || !membersResult.ok ? (
        <CardSurface className="text-sm text-destructive">
          {listingsResult.message ?? membersResult.message}
        </CardSurface>
      ) : listingsResult.listings.length === 0 ? (
        <CardSurface className="border-dashed text-sm text-muted-foreground">
          <p className="mb-3">Спочатку створіть оголошення.</p>
          <Link href="/app/listings/new" className="text-primary underline">
            До оголошень
          </Link>
        </CardSurface>
      ) : (
        <CardSurface>
          <SaleCreateForm
            action={createSale}
            listings={listingsResult.listings}
            members={membersResult.members}
            defaultListingId={params.listing}
            defaultExecutorId={user.id}
            splitDefaults={splitDefaults}
          />
        </CardSurface>
      )}
    </section>
  );
}
