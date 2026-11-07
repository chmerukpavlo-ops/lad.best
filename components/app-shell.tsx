import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AUTH_PATHS } from "@/lib/auth/paths";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href={AUTH_PATHS.home}
            className="font-heading text-lg font-semibold tracking-tight text-foreground"
          >
            Лад
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href={AUTH_PATHS.login}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Вхід
            </Link>
            <Link
              href={AUTH_PATHS.app}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Простір
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-border/80">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-4 text-sm text-muted-foreground sm:px-6">
          <p>Приватний застосунок для двох учасників.</p>
          <p>Redirect recovery: /auth/callback → /auth/update-password</p>
        </div>
      </footer>
    </div>
  );
}

export function ShellStatusActions() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        asChild
        size="lg"
        className="min-h-11 min-w-[11rem] px-5 text-base"
      >
        <Link href={AUTH_PATHS.login}>Увійти</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className="min-h-11 min-w-[11rem] px-5 text-base"
      >
        <Link href={AUTH_PATHS.forgotPassword}>Відновити пароль</Link>
      </Button>
    </div>
  );
}
