"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "calendar_events",
  "calendar_event_exceptions",
  "availability_rules",
] as const;

/**
 * Subscribe to calendar table changes for this workspace.
 * Soft-deletes are UPDATEs, so workspace_id filter works without REPLICA IDENTITY FULL.
 */
export function useCalendarRealtime(workspaceId: string | null | undefined) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        router.refresh();
      }, 250);
    };

    const channel = supabase.channel(`calendar:${workspaceId}`);

    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `workspace_id=eq.${workspaceId}`,
        },
        refresh,
      );
    }

    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, router]);
}
