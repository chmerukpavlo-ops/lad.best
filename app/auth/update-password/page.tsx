import Link from "next/link";
import { redirect } from "next/navigation";

import { updatePassword } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AUTH_PATHS } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect(
      `${AUTH_PATHS.error}?reason=expired&detail=${encodeURIComponent(
        "Немає дійсної сесії відновлення",
      )}`,
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Новий пароль
        </h1>
        <p className="text-sm text-muted-foreground">
          Встановіть новий пароль для свого акаунта.
        </p>
      </div>

      <AuthForm
        action={updatePassword}
        submitLabel="Зберегти пароль"
        fields={[
          {
            name: "password",
            label: "Новий пароль",
            type: "password",
            autoComplete: "new-password",
          },
          {
            name: "confirm",
            label: "Повторіть пароль",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
      />

      <p className="text-sm text-muted-foreground">
        Посилання не працює?{" "}
        <Link
          href={AUTH_PATHS.forgotPassword}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Запросити нове
        </Link>
      </p>
    </section>
  );
}
