import Link from "next/link";

import { signInWithPassword } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AUTH_PATHS } from "@/lib/auth/paths";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? AUTH_PATHS.app;

  return (
    <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Вхід
        </h1>
        <p className="text-sm text-muted-foreground">
          Лише запрошені учасники. Публічної реєстрації немає.
        </p>
      </div>

      {params.error === "env" ? (
        <p className="text-sm text-destructive" role="alert">
          Локальні змінні Supabase ще не налаштовані.
        </p>
      ) : null}

      <AuthForm
        action={signInWithPassword}
        submitLabel="Увійти"
        hiddenFields={{ next }}
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Пароль",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
      />

      <p className="text-sm text-muted-foreground">
        <Link
          href={AUTH_PATHS.forgotPassword}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Забули пароль?
        </Link>
      </p>
    </section>
  );
}
