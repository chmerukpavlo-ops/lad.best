import {
  createAvailabilityEvent,
  getOrCreateScheduleSettings,
  getSharedAvailabilityPreview,
  listAvailabilityEvents,
  softDeleteAvailabilityEvent,
} from "@/app/actions/calendar";
import { listWorkspaceMembers } from "@/app/actions/ads";
import { DayBoard } from "@/components/calendar/day-board";
import {
  AvailabilityEventCreateForm,
  AvailabilityEventDeleteForm,
} from "@/components/calendar/event-form";
import { CardSurface } from "@/components/ui/card-surface";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import {
  formatKyivRange,
  hhMmFromMinute,
  kyivLocalToUtcMs,
} from "@/lib/calendar/kyiv";
import {
  addCalendarDays,
  kyivTodayYmd,
} from "@/lib/summary/period";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Promise<{ day?: string }>;

const WEEKDAY_UA: Record<string, string> = {
  Mon: "Пн",
  Tue: "Вт",
  Wed: "Ср",
  Thu: "Чт",
  Fri: "Пт",
  Sat: "Сб",
  Sun: "Нд",
};

function parseDay(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return kyivTodayYmd();
}

function weekdayLabel(ymd: string): string {
  const ms = kyivLocalToUtcMs(ymd, 12 * 60);
  const en = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    weekday: "short",
  }).format(new Date(ms));
  return WEEKDAY_UA[en] ?? en;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireVerifiedUser();
  const params = await searchParams;
  const dayYmd = parseDay(params.day);
  const today = kyivTodayYmd();

  // Week strip: Mon–Sun containing selected day (Kyiv)
  const noonMs = kyivLocalToUtcMs(dayYmd, 12 * 60);
  const enDow = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    weekday: "short",
  }).format(new Date(noonMs));
  const dowIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    enDow,
  );
  const mondayOffset = dowIndex === 0 ? -6 : 1 - dowIndex;
  const weekStart = addCalendarDays(dayYmd, mondayOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const ymd = addCalendarDays(weekStart, i);
    return {
      ymd,
      label: weekdayLabel(ymd),
      href: `/app/calendar?day=${ymd}`,
    };
  });

  const [previewRes, eventsRes, membersRes, settingsRes] = await Promise.all([
    getSharedAvailabilityPreview(),
    listAvailabilityEvents({
      fromIso: new Date(
        Date.now() - 2 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      toIso: new Date(
        Date.parse(addCalendarDays(kyivTodayYmd(), 21) + "T00:00:00Z"),
      ).toISOString(),
    }),
    listWorkspaceMembers(),
    getOrCreateScheduleSettings(),
  ]);

  const dayStart = settingsRes.ok
    ? settingsRes.settings.day_start_minute
    : 480;
  const dayEnd = settingsRes.ok ? settingsRes.settings.day_end_minute : 1320;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-tight">Календар</h1>

      {settingsRes.ok ? (
        <DayBoard
          dayYmd={dayYmd}
          dayStartMinute={dayStart}
          dayEndMinute={dayEnd}
          members={membersRes.ok ? membersRes.members : []}
          events={eventsRes.ok ? eventsRes.events : []}
          sharedRangeText={
            previewRes.ok ? previewRes.preview.rangeText : null
          }
          weekDays={weekDays}
        />
      ) : (
        <CardSurface className="text-sm text-destructive">
          {settingsRes.message}
        </CardSurface>
      )}

      <CardSurface className="gap-1.5 p-4">
        <p className="text-sm text-muted-foreground">Найближче спільне вікно</p>
        <p className="text-[1.65rem] font-semibold tabular-nums tracking-tight text-primary">
          {previewRes.ok && previewRes.preview.rangeText
            ? previewRes.preview.rangeText
            : "—"}
        </p>
        {dayYmd !== today ? (
          <p className="text-xs text-muted-foreground">
            Обраний день: {dayYmd} (Kyiv)
          </p>
        ) : null}
      </CardSurface>

      <CardSurface>
        <h2 className="mb-4 text-base font-medium">Додати інтервал</h2>
        {!membersRes.ok ? (
          <p className="text-sm text-destructive">{membersRes.message}</p>
        ) : (
          <AvailabilityEventCreateForm
            action={createAvailabilityEvent}
            members={membersRes.members}
            defaultParticipantId={user.id}
          />
        )}
      </CardSurface>

      <CardSurface className="gap-3">
        <h2 className="text-base font-medium">Найближчі інтервали</h2>
        {!eventsRes.ok ? (
          <p className="text-sm text-destructive">{eventsRes.message}</p>
        ) : eventsRes.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Поки немає подій. Порожній календар ≠ вільні дні.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {eventsRes.events.map((ev) => {
              const start = Date.parse(ev.starts_at);
              const end = Date.parse(ev.ends_at);
              const member = membersRes.ok
                ? membersRes.members.find(
                    (m) => m.profile_id === ev.participant_id,
                  )
                : null;
              return (
                <li
                  key={ev.id}
                  className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {ev.kind === "busy" ? "Зайнятий" : "Вільний"}
                      {" · "}
                      {member?.display_name?.trim() || "Учасник"}
                    </p>
                    <p className="tabular-nums text-muted-foreground">
                      {formatKyivRange(start, end)}
                    </p>
                    {ev.note ? (
                      <p className="text-muted-foreground">{ev.note}</p>
                    ) : null}
                  </div>
                  <AvailabilityEventDeleteForm
                    action={softDeleteAvailabilityEvent}
                    eventId={ev.id}
                    version={ev.version}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardSurface>

      {settingsRes.ok ? (
        <p className="text-xs text-muted-foreground">
          Робочі межі: {hhMmFromMinute(dayStart)}–{hhMmFromMinute(dayEnd)}{" "}
          (Kyiv). Busy має пріоритет; спільне вікно — перетин free.
        </p>
      ) : null}
    </section>
  );
}
