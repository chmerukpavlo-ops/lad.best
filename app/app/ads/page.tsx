import Link from "next/link";

import { listAdPayments } from "@/app/actions/ads";
import { CardSurface } from "@/components/ui/card-surface";
import { Button } from "@/components/ui/button";
import {
  dbAmountToKopiyky,
  formatUahDisplay,
} from "@/lib/money/kopiyky";
import { cn } from "cn";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function formatPaidOnUa(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((p) => Number.parseInt(p, 10));
  if (!y || !m || !d) {
    return isoDate;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export default async function AdsPage() {
  const result = await listAdPayments();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Реклама</h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            Ручні платежі на оголошеннях: сума, дата, платник. Без боргів і без
            списання в продаж.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="hidden min-h-11 min-w-[11rem] rounded-xl text-base md:inline-flex"
        >
          <Link href="/app/ads/new">Додати платіж</Link>
        </Button>
      </div>

      {!result.ok ? (
        <CardSurface className="text-sm text-destructive">
          {result.message}
        </CardSurface>
      ) : result.payments.length === 0 ? (
        <CardSurface className="border-dashed text-sm text-muted-foreground">
          <div className="flex flex-col gap-4">
            <p>Поки немає рекламних платежів. Додайте перший до оголошення.</p>
            <Button
              asChild
              size="lg"
              className="min-h-11 w-full rounded-xl text-base sm:w-auto"
            >
              <Link href="/app/ads/new">Додати платіж</Link>
            </Button>
          </div>
        </CardSurface>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.payments.map((payment) => {
            let amountLabel = payment.amount;
            try {
              amountLabel = formatUahDisplay(dbAmountToKopiyky(payment.amount));
            } catch {
              amountLabel = `${payment.amount} ₴`;
            }
            const isVoid = payment.status === "void";

            return (
              <li key={payment.id}>
                <Link
                  href={`/app/ads/${payment.id}`}
                  className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/35 sm:p-5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-medium text-foreground">
                        {payment.listing_title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPaidOnUa(payment.paid_on)}
                        {" · "}
                        {payment.payer_display_name?.trim() || "Учасник"}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      <span
                        className={cn(
                          "text-base font-semibold tabular-nums",
                          isVoid
                            ? "text-muted-foreground line-through"
                            : "text-foreground",
                        )}
                      >
                        {amountLabel}
                      </span>
                      {isVoid ? (
                        <span className="text-xs text-amber-300">
                          Анульовано
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="md:hidden">
        <Button
          asChild
          size="lg"
          className="min-h-11 w-full rounded-xl text-base"
        >
          <Link href="/app/ads/new">Додати платіж</Link>
        </Button>
      </div>
    </section>
  );
}
