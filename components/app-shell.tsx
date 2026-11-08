"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AUTH_PATHS } from "@/lib/auth/paths";

type AppShellProps = {
  children: React.ReactNode;
};

/** Public chrome; skipped under `/app` (workspace shell owns that). */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  if (pathname.startsWith(AUTH_PATHS.app)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href={AUTH_PATHS.home}
            className="text-lg font-semibold tracking-tight text-primary"
          >
            Лад
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href={AUTH_PATHS.login}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Вхід
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-border/80">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 text-sm text-muted-foreground sm:px-6">
          <p>Приватний застосунок для двох учасників.</p>
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
        className="min-h-11 min-w-[11rem] rounded-xl px-5 text-base"
      >
        <Link href={AUTH_PATHS.login}>Увійти</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className="min-h-11 min-w-[11rem] rounded-xl px-5 text-base"
      >
        <Link href={AUTH_PATHS.forgotPassword}>Відновити пароль</Link>
      </Button>
    </div>
  );
}
