import { ShellStatusActions } from "@/components/app-shell";

export default function HomePage() {
  return (
    <section className="flex flex-1 flex-col justify-center gap-8">
      <div className="space-y-4">
        <p className="text-5xl font-semibold tracking-tight text-primary sm:text-6xl">
          Лад
        </p>
        <h1 className="max-w-xl text-xl font-medium text-foreground sm:text-2xl">
          Спільний облік оголошень, реклами й продажів
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
          Приватний застосунок для двох учасників. Увійдіть, щоб працювати з
          оголошеннями.
        </p>
      </div>

      <ShellStatusActions />
    </section>
  );
}
