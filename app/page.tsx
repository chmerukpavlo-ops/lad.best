import { ShellStatusActions } from "@/components/app-shell";
import { LOCAL_AUTH_REDIRECT_URLS } from "@/lib/auth/paths";

export default function HomePage() {
  return (
    <section className="flex flex-1 flex-col justify-center gap-8">
      <div className="space-y-4">
        <p className="font-heading text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Лад
        </p>
        <h1 className="max-w-xl text-xl font-medium text-foreground sm:text-2xl">
          Спільний облік оголошень, реклами й продажів
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
          Gate 1.2: підготовлено локальний вхід і міграцію основи. Віддалену базу
          ще не змінювали.
        </p>
      </div>

      <ShellStatusActions />

      <ul className="max-w-lg space-y-2 text-sm text-muted-foreground">
        <li>Auth: email + пароль, відновлення через email</li>
        <li>
          Redirect URLs (dev): {LOCAL_AUTH_REDIRECT_URLS.join(", ")}
        </li>
        <li>Бізнес-таблиці не створюються на цьому етапі</li>
      </ul>
    </section>
  );
}
