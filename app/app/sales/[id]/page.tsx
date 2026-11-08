import Link from "next/link";
import { notFound } from "next/navigation";

import {
  cancelOpenSaleAction,
  completeSaleAction,
  correctCompletedSaleAction,
  getSale,
  listSalesMembers,
  updateOpenSale,
} from "@/app/actions/sales";
import {
  SaleCancelForm,
  SaleCompleteForm,
  SaleCorrectForm,
  SaleEditForm,
} from "@/components/sales/sale-form";
import { CardSurface } from "@/components/ui/card-surface";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import {
  dbAmountToKopiyky,
  dbSignedAmountToKopiyky,
  formatUahDisplay,
} from "@/lib/money/kopiyky";
import { cn } from "cn";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type PageProps = { params: Promise<{ id: string }> };

function moneyLabel(raw: string, signed = false): string {
  try {
    return formatUahDisplay(
      signed ? dbSignedAmountToKopiyky(raw) : dbAmountToKopiyky(raw),
    );
  } catch {
    return `${raw} ₴`;
  }
}

function statusUa(status: string) {
  if (status === "completed") return "Завершено";
  if (status === "cancelled") return "Скасовано";
  return "Відкритий";
}

export default async function SaleDetailPage({ params }: PageProps) {
  await requireVerifiedUser({ withUserRecord: true });
  const { id } = await params;
  const [saleResult, membersResult] = await Promise.all([
    getSale(id),
    listSalesMembers(),
  ]);

  if (!saleResult.ok || !saleResult.sale) {
    if (saleResult.message?.includes("не знайдено")) {
      notFound();
    }
    return (
      <section className="flex flex-1 flex-col gap-4">
        <CardSurface className="text-sm text-destructive">
          {saleResult.message ?? "Не вдалося відкрити продаж."}
        </CardSurface>
        <Link href="/app/sales" className="text-sm text-primary underline">
          До списку
        </Link>
      </section>
    );
  }

  const sale = saleResult.sale;
  const title = [sale.listing_title, sale.size_text].filter(Boolean).join(", ");
  const tone =
    sale.status === "completed"
      ? "ok"
      : sale.status === "cancelled"
        ? "muted"
        : "warn";

  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: "Ціна продажу", value: moneyLabel(sale.sale_price) },
    { label: "Закупівля", value: `−${moneyLabel(sale.cost_price)}` },
    {
      label: "Прямі витрати",
      value: `−${moneyLabel(sale.direct_expenses)}`,
    },
  ];
  if (sale.margin != null) {
    rows.push({
      label: "Маржа (до реклами)",
      value: moneyLabel(sale.margin, true),
      accent: true,
    });
  }

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/app/sales" className="hover:text-foreground">
            Продажі
          </Link>
          <span aria-hidden="true"> / </span>
          Деталі
        </p>
      </div>

      <CardSurface className="gap-0 p-0">
        <div className="flex items-start justify-between gap-3 border-b border-border/80 px-4 py-4 sm:px-5">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/app/listings/${sale.listing_id}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                Оголошення
              </Link>
              {" · "}
              {sale.sold_on}
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
            {statusUa(sale.status)}
          </span>
        </div>

        <ul>
          {rows.map((row, index) => (
            <li
              key={row.label}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5",
                index < rows.length - 1 ? "border-b border-border/70" : "",
              )}
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span
                className={cn(
                  "tabular-nums font-medium",
                  row.accent ? "text-primary" : "text-foreground",
                )}
              >
                {row.value}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 border-t border-border/80 px-4 py-3 text-sm text-muted-foreground sm:px-5">
          <p>Виконавець: {sale.executor_display_name?.trim() || "Учасник"}</p>
          {sale.color_text ? <p>Колір: {sale.color_text}</p> : null}
          {sale.note ? <p>Примітка: {sale.note}</p> : null}
          {sale.completed_on ? (
            <p>Дата завершення: {sale.completed_on}</p>
          ) : null}
        </div>
      </CardSurface>

      {!membersResult.ok ? (
        <CardSurface className="text-sm text-destructive">
          {membersResult.message}
        </CardSurface>
      ) : null}

      {sale.status === "open" && membersResult.ok ? (
        <>
          <CardSurface>
            <h2 className="mb-4 text-base font-medium">Редагувати</h2>
            <SaleEditForm
              key={`edit-${sale.id}-${sale.version}`}
              action={updateOpenSale}
              saleId={sale.id}
              version={sale.version}
              members={membersResult.members}
              values={{
                sale_price: sale.sale_price,
                cost_price: sale.cost_price,
                direct_expenses: sale.direct_expenses,
                color_text: sale.color_text,
                size_text: sale.size_text,
                note: sale.note,
                sold_on: sale.sold_on,
                executor_id: sale.executor_id,
              }}
            />
          </CardSurface>

          <CardSurface>
            <h2 className="mb-4 text-base font-medium">Завершити</h2>
            <SaleCompleteForm
              key={`complete-${sale.id}-${sale.version}`}
              action={completeSaleAction}
              saleId={sale.id}
              version={sale.version}
              soldOn={sale.sold_on}
            />
          </CardSurface>

          <CardSurface>
            <SaleCancelForm
              key={`cancel-${sale.id}-${sale.version}`}
              action={cancelOpenSaleAction}
              saleId={sale.id}
              version={sale.version}
            />
          </CardSurface>
        </>
      ) : null}

      {sale.status === "completed" && membersResult.ok ? (
        <CardSurface>
          <h2 className="mb-4 text-base font-medium">
            Контрольована корекція
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Звичайне редагування закритих сум заборонено. Потрібна причина й
            новий знімок маржі.
          </p>
          <SaleCorrectForm
            key={`correct-${sale.id}-${sale.version}`}
            action={correctCompletedSaleAction}
            saleId={sale.id}
            version={sale.version}
            members={membersResult.members}
            values={{
              sale_price: sale.sale_price,
              cost_price: sale.cost_price,
              direct_expenses: sale.direct_expenses,
              color_text: sale.color_text,
              size_text: sale.size_text,
              note: sale.note,
              sold_on: sale.sold_on,
              completed_on: sale.completed_on ?? sale.sold_on,
              executor_id: sale.executor_id,
            }}
          />
        </CardSurface>
      ) : null}

      {sale.status === "cancelled" ? (
        <CardSurface className="text-sm text-muted-foreground">
          Скасований продаж не дає маржі.
        </CardSurface>
      ) : null}
    </section>
  );
}
