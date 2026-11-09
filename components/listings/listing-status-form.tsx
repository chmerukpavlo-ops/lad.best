"use client";

import { useActionState } from "react";

import type { ListingActionState, ListingStatus } from "@/lib/listings/types";
import {
  OFFLINE_SAVE_MESSAGE,
  useOnlineStatus,
} from "@/lib/listings/use-online-status";
import { Button } from "@/components/ui/button";

const initialState: ListingActionState = {
  ok: false,
  code: "ok",
  message: "",
};

type ListingStatusFormProps = {
  action: (
    prev: ListingActionState | null,
    formData: FormData,
  ) => Promise<ListingActionState>;
  listingId: string;
  version: number;
  nextStatus: ListingStatus;
  label: string;
  variant?: "outline" | "secondary" | "destructive";
};

export function ListingStatusForm({
  action,
  listingId,
  version,
  nextStatus,
  label,
  variant = "outline",
}: ListingStatusFormProps) {
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={online ? formAction : undefined}
      onSubmit={(event) => {
        if (!online) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={listingId} />
      <input type="hidden" name="version" value={String(version)} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button
        type="submit"
        variant={variant}
        size="lg"
        className="min-h-11 w-full rounded-xl"
        disabled={pending || !online}
      >
        {pending ? "Зачекайте…" : label}
      </Button>
      {!online ? (
        <p className="text-sm text-destructive" role="alert">
          {OFFLINE_SAVE_MESSAGE}
        </p>
      ) : null}
      {online && state.message ? (
        <p
          className={
            state.code === "conflict"
              ? "text-sm text-amber-300"
              : state.ok
                ? "text-sm text-primary"
                : "text-sm text-destructive"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
