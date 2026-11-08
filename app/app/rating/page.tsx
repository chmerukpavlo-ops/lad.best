import Link from "next/link";

import { getRatingLeaderboard } from "@/app/actions/settings";
import { CardSurface } from "@/components/ui/card-surface";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function RatingPage() {
  const board = await getRatingLeaderboard();
  const max = Math.max(1, ...board.rows.map((r) => r.points));

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Рейтинг</h1>
        <Link
          href="/app/settings"
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          Налаштувати ваги
        </Link>
      </div>

      {!board.ok ? (
        <CardSurface className="text-sm text-destructive">
          {board.message ?? "Не вдалося завантажити рейтинг."}
        </CardSurface>
      ) : !board.enabled ? (
        <CardSurface className="gap-2">
          <p className="text-sm text-muted-foreground">
            Рейтинг вимкнено. Увімкніть «Рахувати рейтинг» у налаштуваннях.
          </p>
        </CardSurface>
      ) : (
        <CardSurface className="gap-4">
          <div>
            <h2 className="text-base font-bold">Продуктивність</h2>
            <p className="text-sm text-muted-foreground">
              Бали за виконані дії (з моменту увімкнення / нових подій)
            </p>
          </div>
          {board.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Поки немає балів.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {board.rows.map((row) => (
                <li key={row.profile_id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {row.display_name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {row.points}{" "}
                      {row.points === 1
                        ? "бал"
                        : row.points >= 2 && row.points <= 4
                          ? "бали"
                          : "балів"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.round((row.points / max) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {board.message ? (
            <p className="text-xs text-muted-foreground">{board.message}</p>
          ) : null}
        </CardSurface>
      )}
    </section>
  );
}
