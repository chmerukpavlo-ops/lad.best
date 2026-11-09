"use client";

import { cn } from "cn";

import type { Occurrence } from "@/lib/calendar/recurrence";
import type { LocalInterval } from "@/lib/calendar/local-intervals";
import { EVENT_TYPE_LABELS, formatLocalRange } from "@/lib/calendar/labels";
import { hhMmFromMinute } from "@/lib/calendar/kyiv";

type Member = { profile_id: string; display_name: string | null };

function hourMarks(dayStart: number, dayEnd: number) {
  const out: number[] = [];
  for (let m = dayStart; m <= dayEnd; m += 120) out.push(m);
  return out;
}

function Block({
  start,
  end,
  dayStart,
  dayEnd,
  className,
  children,
  onClick,
}: {
  start: number;
  end: number;
  dayStart: number;
  dayEnd: number;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const span = Math.max(dayEnd - dayStart, 1);
  const s = Math.max(dayStart, start);
  const e = Math.min(dayEnd, end);
  if (e <= s) return null;
  const top = ((s - dayStart) / span) * 100;
  const height = ((e - s) / span) * 100;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "absolute inset-x-1 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight",
          className,
        )}
        style={{ top: `${top}%`, height: `${height}%` }}
      >
        {children}
      </button>
    );
  }
  return (
    <div
      className={cn(
        "absolute inset-x-1 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight",
        className,
      )}
      style={{ top: `${top}%`, height: `${height}%` }}
    >
      {children}
    </div>
  );
}

export function DayBoardV2({
  dayYmd,
  dayStartMinute,
  dayEndMinute,
  members,
  occurrences,
  shared,
  onSelectOccurrence,
}: {
  dayYmd: string;
  dayStartMinute: number;
  dayEndMinute: number;
  members: Member[];
  occurrences: Occurrence[];
  shared: LocalInterval[];
  onSelectOccurrence: (occ: Occurrence) => void;
}) {
  const hours = hourMarks(dayStartMinute, dayEndMinute);
  const cols = members.slice(0, 2);
  while (cols.length < 2) {
    cols.push({
      profile_id: `ph-${cols.length}`,
      display_name: `Учасник ${cols.length + 1}`,
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div
        className="grid min-w-[20rem] gap-2"
        style={{
          gridTemplateColumns: `3rem repeat(${cols.length}, minmax(0, 1fr))`,
        }}
      >
        <div />
        {cols.map((m) => (
          <p
            key={m.profile_id}
            className="truncate text-center text-xs text-muted-foreground"
          >
            {m.display_name?.trim() || "Учасник"}
          </p>
        ))}

        <div className="relative h-[320px]">
          {hours.map((m) => (
            <span
              key={m}
              className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{
                top: `${((m - dayStartMinute) / Math.max(dayEndMinute - dayStartMinute, 1)) * 100}%`,
              }}
            >
              {hhMmFromMinute(m)}
            </span>
          ))}
        </div>

        {cols.map((m) => {
          const mine = occurrences.filter((o) =>
            o.participants.includes(m.profile_id),
          );
          return (
            <div
              key={m.profile_id}
              className="relative h-[320px] rounded-xl bg-[#101114]"
            >
              {hours.map((minute) => (
                <div
                  key={`${m.profile_id}-${minute}`}
                  className="absolute inset-x-0 border-t border-border/40"
                  style={{
                    top: `${((minute - dayStartMinute) / Math.max(dayEndMinute - dayStartMinute, 1)) * 100}%`,
                  }}
                />
              ))}
              {shared.map((w) => (
                <Block
                  key={`sh-${w.start}`}
                  start={w.start}
                  end={w.end}
                  dayStart={dayStartMinute}
                  dayEnd={dayEndMinute}
                  className="pointer-events-none border border-dashed border-primary/60 bg-primary/10 text-primary"
                >
                  Спільне
                </Block>
              ))}
              {mine.map((occ) => (
                <Block
                  key={`${occ.eventId}-${occ.occurrenceDate}-${occ.startMinute}`}
                  start={occ.startMinute}
                  end={occ.endMinute}
                  dayStart={dayStartMinute}
                  dayEnd={dayEndMinute}
                  className={
                    occ.eventType === "free"
                      ? "border border-dashed border-primary/50 bg-primary/10 text-primary"
                      : "bg-[#2a2d34] text-foreground hover:bg-[#32353d]"
                  }
                  onClick={() => onSelectOccurrence(occ)}
                >
                  {EVENT_TYPE_LABELS[occ.eventType]}{" "}
                  {formatLocalRange(occ.startMinute, occ.endMinute)}
                </Block>
              ))}
            </div>
          );
        })}
      </div>
      <p className="sr-only">{dayYmd}</p>
    </div>
  );
}

export function WeekBoardV2({
  days,
  dayStartMinute,
  dayEndMinute,
  memberIds,
  occurrencesByDay,
  sharedByDay,
  onSelectDay,
  onSelectOccurrence,
}: {
  days: { ymd: string; label: string; dayNum: string }[];
  dayStartMinute: number;
  dayEndMinute: number;
  memberIds: string[];
  occurrencesByDay: Record<string, Occurrence[]>;
  sharedByDay: Record<string, LocalInterval[]>;
  onSelectDay: (ymd: string) => void;
  onSelectOccurrence: (occ: Occurrence) => void;
}) {
  const hours = hourMarks(dayStartMinute, dayEndMinute);
  const span = Math.max(dayEndMinute - dayStartMinute, 1);
  const a = memberIds[0];
  const b = memberIds[1];

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-2 sm:p-3">
      <div
        className="grid min-w-[56rem] gap-1"
        style={{
          gridTemplateColumns: `2.5rem repeat(7, minmax(0, 1fr))`,
        }}
      >
        <div />
        {days.map((d) => (
          <button
            key={d.ymd}
            type="button"
            onClick={() => onSelectDay(d.ymd)}
            className="truncate py-1 text-center text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {d.label} {d.dayNum}
          </button>
        ))}

        <div className="relative h-[420px]">
          {hours.map((m) => (
            <span
              key={m}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ top: `${((m - dayStartMinute) / span) * 100}%` }}
            >
              {hhMmFromMinute(m)}
            </span>
          ))}
        </div>

        {days.map((d) => {
          const occs = occurrencesByDay[d.ymd] ?? [];
          const shared = sharedByDay[d.ymd] ?? [];
          return (
            <div
              key={d.ymd}
              className="relative h-[420px] rounded-lg bg-[#101114]"
            >
              {hours.map((minute) => (
                <div
                  key={`${d.ymd}-${minute}`}
                  className="absolute inset-x-0 border-t border-border/30"
                  style={{
                    top: `${((minute - dayStartMinute) / span) * 100}%`,
                  }}
                />
              ))}
              {shared.map((w) => (
                <Block
                  key={`s-${d.ymd}-${w.start}`}
                  start={w.start}
                  end={w.end}
                  dayStart={dayStartMinute}
                  dayEnd={dayEndMinute}
                  className="pointer-events-none border border-dashed border-primary/50 bg-primary/10"
                />
              ))}
              {occs.map((occ) => {
                const mineA = a && occ.participants.includes(a);
                const mineB = b && occ.participants.includes(b);
                const tone =
                  occ.eventType === "free"
                    ? "border border-dashed border-primary/40 bg-primary/10"
                    : mineA && mineB
                      ? "bg-[#3a3d45]"
                      : mineA
                        ? "bg-[#2a2d34]"
                        : "bg-[#23262d]";
                return (
                  <Block
                    key={`${occ.eventId}-${occ.occurrenceDate}-${occ.startMinute}`}
                    start={occ.startMinute}
                    end={occ.endMinute}
                    dayStart={dayStartMinute}
                    dayEnd={dayEndMinute}
                    className={cn(tone, "hover:opacity-90")}
                    onClick={() => onSelectOccurrence(occ)}
                  >
                    {EVENT_TYPE_LABELS[occ.eventType]}
                  </Block>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
