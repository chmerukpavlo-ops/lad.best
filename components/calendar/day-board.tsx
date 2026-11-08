import { cn } from "cn";

import type { AvailabilityEvent } from "@/lib/calendar/types";
import {
  formatKyivTime,
  hhMmFromMinute,
  utcMsToKyivYmd,
} from "@/lib/calendar/kyiv";

type Member = { profile_id: string; display_name: string | null };

type DayBoardProps = {
  dayYmd: string;
  dayStartMinute: number;
  dayEndMinute: number;
  members: Member[];
  events: AvailabilityEvent[];
  sharedRangeText: string | null;
  weekDays: { ymd: string; label: string; href: string }[];
};

function minuteOfDayFromIso(iso: string): number {
  const [h, m] = formatKyivTime(Date.parse(iso)).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function DayBoard({
  dayYmd,
  dayStartMinute,
  dayEndMinute,
  members,
  events,
  sharedRangeText,
  weekDays,
}: DayBoardProps) {
  const span = Math.max(dayEndMinute - dayStartMinute, 1);
  const hours: number[] = [];
  for (let m = dayStartMinute; m <= dayEndMinute; m += 120) {
    hours.push(m);
  }

  const colMembers = members.slice(0, 2);
  while (colMembers.length < 2) {
    colMembers.push({
      profile_id: `placeholder-${colMembers.length}`,
      display_name: `Учасник ${colMembers.length + 1}`,
    });
  }

  const dayEvents = events.filter(
    (e) => utcMsToKyivYmd(Date.parse(e.starts_at)) === dayYmd,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex min-h-9 items-center rounded-full bg-secondary px-3.5 text-sm font-medium text-muted-foreground">
          Тиждень
        </span>
        <span className="inline-flex min-h-9 items-center rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground">
          День
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {weekDays.map((d) => (
          <a
            key={d.ymd}
            href={d.href}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-full text-sm font-medium",
              d.ymd === dayYmd
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {d.label}
          </a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div
          className="grid min-w-[20rem] gap-2"
          style={{
            gridTemplateColumns: `3rem repeat(${colMembers.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {colMembers.map((m) => (
            <p
              key={m.profile_id}
              className="truncate text-center text-xs text-muted-foreground"
            >
              {m.display_name?.trim() || "Учасник"}
            </p>
          ))}

          <div className="relative h-[280px]">
            {hours.map((m) => {
              const top = ((m - dayStartMinute) / span) * 100;
              return (
                <span
                  key={m}
                  className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                  style={{ top: `${top}%` }}
                >
                  {hhMmFromMinute(m)}
                </span>
              );
            })}
          </div>

          {colMembers.map((m) => {
            const mine = dayEvents.filter(
              (e) => e.participant_id === m.profile_id,
            );
            return (
              <div
                key={m.profile_id}
                className="relative h-[280px] rounded-xl bg-[#101114]"
              >
                {hours.map((minute) => {
                  const top = ((minute - dayStartMinute) / span) * 100;
                  return (
                    <div
                      key={`${m.profile_id}-${minute}`}
                      className="absolute inset-x-0 border-t border-border/50"
                      style={{ top: `${top}%` }}
                    />
                  );
                })}
                {mine.map((ev) => {
                  const startM = Math.max(
                    dayStartMinute,
                    minuteOfDayFromIso(ev.starts_at),
                  );
                  const endM = Math.min(
                    dayEndMinute,
                    minuteOfDayFromIso(ev.ends_at),
                  );
                  if (endM <= startM) return null;
                  const top = ((startM - dayStartMinute) / span) * 100;
                  const height = ((endM - startM) / span) * 100;
                  return (
                    <div
                      key={ev.id}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-[11px] leading-tight",
                        ev.kind === "busy"
                          ? "bg-[#2a2d34] text-foreground"
                          : "border border-dashed border-primary/70 bg-primary/10 text-primary",
                      )}
                      style={{ top: `${top}%`, height: `${height}%` }}
                    >
                      {ev.kind === "busy" ? "Зайнятий" : "Вільний"}{" "}
                      {hhMmFromMinute(startM)}–{hhMmFromMinute(endM)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {sharedRangeText ? (
          <p className="mt-3 rounded-xl border border-dashed border-primary/60 bg-primary/5 px-3 py-2 text-center text-sm font-medium text-primary">
            Спільне вікно {sharedRangeText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
