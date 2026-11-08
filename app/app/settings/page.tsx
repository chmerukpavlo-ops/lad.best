import {
  getOrCreateFinanceSettings,
  getOrCreateRatingSettings,
  getOwnProfile,
  listSettingsMembers,
  updateDisplayName,
  updateFinanceSettings,
  updateRatingSettings,
  updateWorkHours,
} from "@/app/actions/settings";
import { getOrCreateScheduleSettings } from "@/app/actions/calendar";
import {
  FinanceSettingsForm,
  ProfileForm,
  RatingSettingsForm,
  WorkHoursForm,
} from "@/components/settings/settings-forms";
import { SignOutButton } from "@/components/pwa/sign-out-button";
import { CardSurface } from "@/components/ui/card-surface";
import { hhMmFromMinute } from "@/lib/calendar/kyiv";
import { RATING_ACTION_LABELS } from "@/lib/settings/finance-rating";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function SettingsPage() {
  const [profileRes, membersRes, settingsRes, financeRes, ratingRes] =
    await Promise.all([
      getOwnProfile(),
      listSettingsMembers(),
      getOrCreateScheduleSettings(),
      getOrCreateFinanceSettings(),
      getOrCreateRatingSettings(),
    ]);

  const profile = profileRes.profile;
  const members = membersRes.ok ? membersRes.members : [];
  const seatsTaken = members.length;
  const dayStart = settingsRes.ok
    ? hhMmFromMinute(settingsRes.settings.day_start_minute)
    : "08:00";
  const dayEnd = settingsRes.ok
    ? hhMmFromMinute(settingsRes.settings.day_end_minute)
    : "22:00";
  const version = settingsRes.ok ? settingsRes.settings.version : 1;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-tight">Налаштування</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <CardSurface className="gap-4">
            <h2 className="text-base font-bold">Профіль</h2>
            {!profileRes.ok || !profile ? (
              <p className="text-sm text-destructive">
                {profileRes.message ?? "Профіль недоступний."}
              </p>
            ) : (
              <ProfileForm
                action={updateDisplayName}
                displayName={profile.display_name}
                email={profile.email ?? ""}
              />
            )}
          </CardSurface>

          <CardSurface className="gap-4">
            <h2 className="text-base font-bold">Учасники</h2>
            <p className="text-sm text-muted-foreground">
              {seatsTaken} з 2 місць зайнято. Кожен змінює лише своє імʼя.
            </p>
            {!membersRes.ok ? (
              <p className="text-sm text-destructive">{membersRes.message}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {members.map((m) => (
                  <li
                    key={m.profile_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm"
                  >
                    <span className="font-medium">
                      {m.display_name?.trim() || "Учасник"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.isYou ? "Ви" : "Приєднався"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardSurface>

          <CardSurface className="gap-4">
            <h2 className="text-base font-bold">Спільні фінанси</h2>
            {!financeRes.ok || !financeRes.settings ? (
              <p className="text-sm text-muted-foreground">
                {financeRes.message ??
                  "Частки недоступні, доки не застосовано міграцію."}
              </p>
            ) : (
              <FinanceSettingsForm
                key={`fin-${financeRes.settings.version}`}
                action={updateFinanceSettings}
                splitEnabled={financeRes.settings.split_enabled}
                percentA={financeRes.settings.percent_a}
                percentB={financeRes.settings.percent_b}
                labelA={financeRes.memberLabels.a}
                labelB={financeRes.memberLabels.b}
                version={financeRes.settings.version}
              />
            )}
          </CardSurface>
        </div>

        <div className="flex flex-col gap-4">
          <CardSurface className="gap-4">
            <h2 className="text-base font-bold">Бали рейтингу</h2>
            {!ratingRes.ok || !ratingRes.settings ? (
              <p className="text-sm text-muted-foreground">
                {ratingRes.message ??
                  "Рейтинг недоступний, доки не застосовано міграцію."}
              </p>
            ) : (
              <RatingSettingsForm
                key={`rat-${ratingRes.settings.version}`}
                action={updateRatingSettings}
                ratingEnabled={ratingRes.settings.rating_enabled}
                weights={ratingRes.settings.weights}
                labels={RATING_ACTION_LABELS}
                version={ratingRes.settings.version}
              />
            )}
          </CardSurface>

          <CardSurface className="gap-4">
            <h2 className="text-base font-bold">Робочі межі</h2>
            {!settingsRes.ok ? (
              <p className="text-sm text-destructive">{settingsRes.message}</p>
            ) : (
              <WorkHoursForm
                key={`hours-${version}-${dayStart}-${dayEnd}`}
                action={updateWorkHours}
                dayStart={dayStart}
                dayEnd={dayEnd}
                version={version}
              />
            )}
          </CardSurface>

          <CardSurface className="gap-4">
            <h2 className="text-base font-bold">Додатково</h2>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <dt className="text-muted-foreground">Часовий пояс</dt>
                <dd className="font-medium tabular-nums">Europe/Kyiv</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <dt className="text-muted-foreground">Валюта</dt>
                <dd className="font-medium">₴ UAH</dd>
              </div>
            </dl>
            <SignOutButton />
          </CardSurface>
        </div>
      </div>
    </section>
  );
}
