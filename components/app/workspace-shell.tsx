"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "cn";

import { NavLink } from "@/components/app/nav-link";
import {
  MOBILE_MORE_ITEM,
  WORKSPACE_NAV,
  mobileBottomItems,
  navLabel,
} from "@/lib/app/nav";

type WorkspaceShellProps = {
  children: React.ReactNode;
};

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const [navPending, setNavPending] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const desktopItems = WORKSPACE_NAV.filter((item) => item.desktop);
  const mobileBottom = mobileBottomItems();
  const showPlus =
    pathname === "/app" ||
    pathname.startsWith("/app/listings") ||
    pathname.startsWith("/app/sales") ||
    pathname.startsWith("/app/calendar") ||
    pathname.startsWith("/app/models");

  const plusHref = pathname.startsWith("/app/sales")
    ? "/app/sales/new"
    : pathname.startsWith("/app/calendar")
      ? "/app/calendar"
      : pathname.startsWith("/app/models")
        ? "/app/models"
        : "/app/listings/new";

  const onPendingChange = useCallback((pending: boolean) => {
    setNavPending(pending);
  }, []);

  useEffect(() => {
    if (navPending) {
      setShowBar(true);
      return;
    }
    const t = window.setTimeout(() => setShowBar(false), 160);
    return () => window.clearTimeout(t);
  }, [navPending]);

  useEffect(() => {
    setNavPending(false);
    setShowBar(false);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-[12.75rem] shrink-0 flex-col border-r border-border/80 bg-[#101114] px-3 py-5 lg:w-[13.5rem] md:flex">
        <Link
          href="/app"
          className="px-2.5 text-[1.4rem] font-semibold tracking-tight text-primary"
        >
          Лад
        </Link>
        <nav className="mt-8 flex flex-1 flex-col gap-0.5" aria-label="Розділи">
          {desktopItems.map((item) => {
            const active = item.match(pathname);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                active={active}
                onPendingChange={onPendingChange}
                className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors"
                activeClassName="bg-[#1c1e24] text-foreground"
                inactiveClassName="text-muted-foreground hover:bg-[#1c1e24]/60 hover:text-foreground"
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-[2px]",
                    active ? "bg-primary" : "bg-[#3a3d46]",
                  )}
                  aria-hidden
                />
                <span className="truncate">{navLabel(item, "desktop")}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {showBar ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-secondary"
            aria-hidden
          >
            <div className="lad-nav-indeterminate h-full w-1/3 bg-primary" />
          </div>
        ) : null}

        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-md md:hidden">
          <Link
            href="/app"
            className="text-lg font-semibold tracking-tight text-primary"
          >
            Лад
          </Link>
          {showPlus ? (
            <NavLink
              href={plusHref}
              onPendingChange={onPendingChange}
              className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-xl font-semibold leading-none text-primary-foreground"
            >
              <span className="sr-only">Додати</span>+
            </NavLink>
          ) : (
            <span className="size-10" aria-hidden />
          )}
        </header>

        <main className="w-full flex-1 px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-8 lg:px-8">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-[#101114]/95 backdrop-blur-md md:hidden"
          aria-label="Нижня навігація"
        >
          <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2">
            {mobileBottom.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href} className="min-w-0 flex-1">
                  <NavLink
                    href={item.href}
                    active={active}
                    onPendingChange={onPendingChange}
                    className="flex min-h-11 flex-col items-center justify-center px-1 text-[11px] font-medium"
                    activeClassName="text-primary"
                    inactiveClassName="text-muted-foreground"
                  >
                    <span className="truncate">
                      {navLabel(item, "mobile")}
                    </span>
                  </NavLink>
                </li>
              );
            })}
            <li className="min-w-0 flex-1">
              <NavLink
                href={MOBILE_MORE_ITEM.href}
                active={MOBILE_MORE_ITEM.match(pathname)}
                onPendingChange={onPendingChange}
                className="flex min-h-11 flex-col items-center justify-center px-1 text-[11px] font-medium"
                activeClassName="text-primary"
                inactiveClassName="text-muted-foreground"
              >
                <span>{MOBILE_MORE_ITEM.label}</span>
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
