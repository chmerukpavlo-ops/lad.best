import Link from "next/link";

import { AUTH_PATHS } from "@/lib/auth/paths";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; detail?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason ?? "unknown";

  const title =
    reason === "expired" || reason === "link"
      ? "Посилання недійсне або прострочене"
      : reason === "missing_code"
        ? "Відсутній код підтвердження"
        : "Помилка автентифікації";

  const hint =
    reason === "expired" || reason === "link"
      ? "Запросіть нове відновлення пароля та відкрийте свіжий лист."
      : "Спробуйте увійти знову або запросити нове посилання.";

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{hint}</p>
        {params.detail ? (
          <p className="text-xs text-muted-foreground/80 break-words">
            {params.detail}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 text-sm">
        <Link
          href={AUTH_PATHS.forgotPassword}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Запросити нове посилання
        </Link>
        <Link
          href={AUTH_PATHS.login}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Назад до входу
        </Link>
      </div>
    </section>
  );
}
