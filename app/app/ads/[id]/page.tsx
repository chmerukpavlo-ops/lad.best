import Link from "next/link";
import { notFound } from "next/navigation";

import {
  correctAdPayment,
  getAdPayment,
  listWorkspaceMembers,
} from "@/app/actions/ads";
import { AdPaymentCorrectForm } from "@/components/ads/ad-payment-form";
import { CardSurface } from "@/components/ui/card-surface";
import { DetailBackNav } from "@/components/ui/detail-back-nav";
import {
  dbAmountToKopiyky,
  formatUahDisplay,
} from "@/lib/money/kopiyky";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdPaymentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [paymentResult, membersResult] = await Promise.all([
    getAdPayment(id),
    listWorkspaceMembers(),
  ]);

  if (!paymentResult.ok || !paymentResult.payment) {
    if (paymentResult.message?.includes("не знайдено")) {
      notFound();
    }
    return (
      <section className="flex flex-1 flex-col gap-4">
        <CardSurface className="text-sm text-destructive">
          {paymentResult.message ?? "Не вдалося відкрити платіж."}
        </CardSurface>
        <Link href="/app/ads" className="text-sm text-primary underline">
          До списку
        </Link>
      </section>
    );
  }

  const payment = paymentResult.payment;
  let amountLabel = `${payment.amount} ₴`;
  try {
    amountLabel = formatUahDisplay(dbAmountToKopiyky(payment.amount));
  } catch {
    /* keep raw */
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="space-y-2">
        <DetailBackNav
          href="/app/ads"
          sectionLabel="Реклама"
          currentLabel="Платіж"
        />
        <h1 className="text-3xl font-semibold tracking-tight">{amountLabel}</h1>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/app/listings/${payment.listing_id}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {payment.listing_title}
          </Link>
          {" · "}
          {payment.status === "void" ? "анульований" : "дійсний"}
        </p>
        <p className="text-sm text-muted-foreground">
          Виправлення лише з причиною й журналом. Конфлікт версії показується
          явно.
        </p>
      </div>

      {!membersResult.ok ? (
        <CardSurface className="text-sm text-destructive">
          {membersResult.message}
        </CardSurface>
      ) : (
        <CardSurface>
          <h2 className="mb-4 text-base font-medium">Контрольоване виправлення</h2>
          <AdPaymentCorrectForm
            key={`${payment.id}-${payment.version}`}
            action={correctAdPayment}
            paymentId={payment.id}
            version={payment.version}
            members={membersResult.members}
            values={{
              amount: payment.amount,
              paid_on: payment.paid_on,
              payer_id: payment.payer_id,
              note: payment.note,
              status: payment.status,
            }}
          />
        </CardSurface>
      )}
    </section>
  );
}
