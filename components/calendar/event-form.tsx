"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { WorkspaceMemberOption } from "@/lib/ads/types";
import type { CalendarActionState } from "@/lib/calendar/types";
import {
  OFFLINE_SAVE_MESSAGE,
  useOnlineStatus,
} from "@/lib/listings/use-online-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: CalendarActionState = { ok: false, code: "ok", message: "" };

function kyivNowLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function AvailabilityEventCreateForm({
  action,
  members,
  defaultParticipantId,
}: {
  action: (
    prev: CalendarActionState | null,
    formData: FormData,
  ) => Promise<CalendarActionState>;
  members: WorkspaceMemberOption[];
  defaultParticipantId: string;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initial);
  const [starts] = useState(() => kyivNowLocal());

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, state.message, router]);

  return (
    <form
      action={online ? formAction : undefined}
      onSubmit={(e) => {
        if (!online) e.preventDefault();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="participant_id">Учасник</Label>
        <select
          id="participant_id"
          name="participant_id"
          required
          defaultValue={defaultParticipantId}
          disabled={pending || !online}
          className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          {members.map((m) => (
            <option key={m.profile_id} value={m.profile_id}>
              {m.display_name?.trim() || "Учасник"}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="kind">Тип</Label>
        <select
          id="kind"
          name="kind"
          required
          defaultValue="free"
          disabled={pending || !online}
          className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          <option value="free">Вільний</option>
          <option value="busy">Зайнятий</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="starts_at">Початок (Kyiv)</Label>
        <Input
          id="starts_at"
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={starts}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ends_at">Кінець (Kyiv)</Label>
        <Input
          id="ends_at"
          name="ends_at"
          type="datetime-local"
          required
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="note">Опис</Label>
        <Textarea
          id="note"
          name="note"
          maxLength={2000}
          className="min-h-16 rounded-xl"
          disabled={pending || !online}
        />
      </div>
      {!online ? (
        <p className="text-sm text-destructive">{OFFLINE_SAVE_MESSAGE}</p>
      ) : null}
      {online && state.message ? (
        <p
          className={
            state.ok ? "text-sm text-primary" : "text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="min-h-11 rounded-xl"
        disabled={pending || !online}
      >
        {pending ? "Збереження…" : "Додати інтервал"}
      </Button>
    </form>
  );
}

export function AvailabilityEventDeleteForm({
  action,
  eventId,
  version,
}: {
  action: (
    prev: CalendarActionState | null,
    formData: FormData,
  ) => Promise<CalendarActionState>;
  eventId: string;
  version: number;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, state.message, router]);

  return (
    <form
      action={online ? formAction : undefined}
      onSubmit={(e) => {
        if (!online) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="version" value={String(version)} />
      {state.message ? (
        <p className="mb-2 text-xs text-destructive">{state.message}</p>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="min-h-10 rounded-xl"
        disabled={pending || !online}
      >
        Видалити
      </Button>
    </form>
  );
}
