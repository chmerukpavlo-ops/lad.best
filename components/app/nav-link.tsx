"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useTransition,
  type ReactNode,
  type MouseEvent,
} from "react";

import { cn } from "cn";

type NavLinkProps = {
  href: string;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  active?: boolean;
  children: ReactNode;
  onPendingChange?: (pending: boolean) => void;
};

/** Instant pending feedback while the next RSC page loads. */
export function NavLink({
  href,
  className,
  activeClassName,
  inactiveClassName,
  active,
  children,
  onPendingChange,
}: NavLinkProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-busy={pending || undefined}
      className={cn(
        className,
        active ? activeClassName : inactiveClassName,
        pending && "opacity-70",
      )}
    >
      {children}
    </Link>
  );
}
