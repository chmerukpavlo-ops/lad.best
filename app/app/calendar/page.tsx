import { listWorkspaceMembers } from "@/app/actions/ads";
import { getOrCreateScheduleSettings } from "@/app/actions/calendar";
import { listCalendarV2Bundle } from "@/app/actions/calendar-v2";
import { CalendarApp } from "@/components/calendar/calendar-app";
import { CardSurface } from "@/components/ui/card-surface";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { kyivLocalToUtcMs } from "@/lib/calendar/kyiv";
import { addDaysYmd } from "@/lib/calendar/ymd";
import { addCalendarDays, kyivTodayYmd } from "@/lib/summary/period";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Promise<{ day?: string; view?: string }>;

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

function dayNum(ymd: string): string {
  return String(Number(ymd.slice(8, 10)));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireVerifiedUser();
  const params = await searchParams;
  const dayYmd = parseDay(params.day);
  const view = params.view === "day" ? "day" : "week";

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
      dayNum: dayNum(ymd),
    };
  });

  const rangeStart = addDaysYmd(weekStart, -7);
  const rangeEnd = addDaysYmd(weekStart, 28);

  const [bundle, membersRes, settingsRes] = await Promise.all([
    listCalendarV2Bundle({ rangeStart, rangeEnd }),
    listWorkspaceMembers(),
    getOrCreateScheduleSettings(),
  ]);

  if (!settingsRes.ok) {
    return (
      <section className="flex flex-1 flex-col gap-4">
        <h1 className="text-3xl font-semibold">Календар</h1>
        <CardSurface className="text-sm text-destructive">
          {settingsRes.message}
        </CardSurface>
      </section>
    );
  }

  if (!bundle.ok) {
    return (
      <section className="flex flex-1 flex-col gap-4">
        <h1 className="text-3xl font-semibold">Календар</h1>
        <CardSurface className="text-sm text-destructive">
          {bundle.message}
        </CardSurface>
      </section>
    );
  }

  return (
    <CalendarApp
      view={view}
      dayYmd={dayYmd}
      weekStart={weekStart}
      weekDays={weekDays}
      workspaceId={settingsRes.settings.workspace_id}
      currentUserId={user.id}
      members={membersRes.ok ? membersRes.members : []}
      dayStartMinute={settingsRes.settings.day_start_minute}
      dayEndMinute={settingsRes.settings.day_end_minute}
      events={bundle.events}
      exceptions={bundle.exceptions}
      rules={bundle.rules}
    />
  );
}
