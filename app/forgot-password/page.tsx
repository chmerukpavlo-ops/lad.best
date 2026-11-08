import Link from "next/link";

import { requestPasswordReset } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AUTH_PATHS } from "@/lib/auth/paths";

export default function ForgotPasswordPage() {
  return (
    <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Відновлення пароля
        </h1>
        <p className="text-sm text-muted-foreground">
          Надішлемо посилання на email. Потрібна реальна доступна скринька.
        </p>
      </div>

      <AuthForm
        action={requestPasswordReset}
        submitLabel="Надіслати посилання"
        successRedirectHint="Перевірте пошту та відкрийте лист на цьому ж пристрої/браузері."
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
        ]}
      />

      <p className="text-sm text-muted-foreground">
        <Link
          href={AUTH_PATHS.login}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Назад до входу
        </Link>
      </p>
    </section>
  );
}
