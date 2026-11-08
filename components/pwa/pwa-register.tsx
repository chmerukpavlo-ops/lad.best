"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { clearPrivateClientCaches } from "@/lib/pwa/clear-private-cache";

export function PwaRegister() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* install still works on iOS without SW */
      });
  }, []);

  useEffect(() => {
    if (searchParams.get("signed_out") === "1") {
      void clearPrivateClientCaches();
    }
  }, [searchParams]);

  useEffect(() => {
    // Leaving the private workspace after logout lands on /login.
    if (pathname === "/login" || pathname === "/forgot-password") {
      void clearPrivateClientCaches();
    }
  }, [pathname]);

  return null;
}
