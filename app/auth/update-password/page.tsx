import Link from "next/link";

import { updatePassword } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AUTH_PATHS } from "@/lib/auth/paths";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  await requireVerifiedUser({ withUserRecord: true });

  return (
    <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
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
