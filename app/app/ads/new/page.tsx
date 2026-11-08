import Link from "next/link";

import {
  createAdPayment,
  listListingsForAds,
  listWorkspaceMembers,
} from "@/app/actions/ads";
import { AdPaymentCreateForm } from "@/components/ads/ad-payment-form";
import { CardSurface } from "@/components/ui/card-surface";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Promise<{ listing?: string }>;

export default async function NewAdPaymentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireVerifiedUser({ withUserRecord: true });
  const params = await searchParams;
  const [listingsResult, membersResult] = await Promise.all([
    listListingsForAds(),
    listWorkspaceMembers(),
  ]);

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/app/ads" className="hover:text-foreground">
            Реклама
          </Link>
          <span aria-hidden="true"> / </span>
          Новий платіж
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Додати платіж
        </h1>
        <p className="text-sm text-muted-foreground">
          Повтор того самого запиту не створить дубль. Офлайн-запис вимкнено.
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
          <AdPaymentCreateForm
            action={createAdPayment}
            listings={listingsResult.listings}
            members={membersResult.members}
            defaultListingId={params.listing}
            defaultPayerId={user.id}
          />
        </CardSurface>
      )}
    </section>
  );
}
