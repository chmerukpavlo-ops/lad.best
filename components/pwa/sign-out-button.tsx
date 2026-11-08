"use client";

import { useTransition } from "react";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { clearPrivateClientCaches } from "@/lib/pwa/clear-private-cache";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="min-h-11 w-full rounded-xl sm:w-auto"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await clearPrivateClientCaches();
          await signOut();
        });
      }}
    >
      {pending ? "Вихід…" : "Вийти"}
    </Button>
  );
}
