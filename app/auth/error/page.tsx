import Link from "next/link";

import { AUTH_PATHS } from "@/lib/auth/paths";

const MESSAGES: Record<string, { title: string; hint: string }> = {
  expired: {
    title: "Посилання недійсне або прострочене",
    hint: "Запросіть нове відновлення пароля та відкрийте свіжий лист.",
  },
  link: {
    title: "Посилання недійсне або прострочене",
    hint: "Запросіть нове відновлення пароля та відкрийте свіжий лист.",
  },
  missing_code: {
    title: "Відсутній код підтвердження",
    hint: "Спробуйте увійти знову або запросити нове посилання.",
  },
  session: {
    title: "Не вдалося підтвердити сесію",
    hint: "Спробуйте увійти знову або запросити нове посилання.",
  },
  unknown: {
    title: "Помилка автентифікації",
    hint: "Спробуйте увійти знову або запросити нове посилання.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason && MESSAGES[params.reason] ? params.reason : "unknown";
  const { title, hint } = MESSAGES[reason];

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{hint}</p>
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
