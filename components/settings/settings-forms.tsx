"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { SettingsActionState } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_PATHS } from "@/lib/auth/paths";

const initial: SettingsActionState = { ok: false, code: "ok", message: "" };

export function ProfileForm({
  action,
  displayName,
  email,
}: {
  action: (
    prev: SettingsActionState | null,
    formData: FormData,
  ) => Promise<SettingsActionState>;
  displayName: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="display_name">Ваше імʼя</Label>
        <Input
          id="display_name"
          name="display_name"
          defaultValue={displayName}
          required
          maxLength={80}
          className="min-h-11"
          disabled={pending}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          value={email}
          readOnly
          className="min-h-11 opacity-80"
        />
      </div>
      {state.message ? (
        <p
          className={
            state.ok ? "text-sm text-primary" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 rounded-xl"
          disabled={pending}
        >
          {pending ? "Збереження…" : "Зберегти"}
        </Button>
        <Button
          asChild
          type="button"
          variant="secondary"
          size="lg"
          className="min-h-11 rounded-xl"
        >
          <Link href={AUTH_PATHS.updatePassword}>Змінити пароль</Link>
        </Button>
      </div>
    </form>
  );
}

export function WorkHoursForm({
  action,
  dayStart,
  dayEnd,
  version,
}: {
  action: (
    prev: SettingsActionState | null,
    formData: FormData,
  ) => Promise<SettingsActionState>;
  dayStart: string;
  dayEnd: string;
  version: number;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="version" value={version} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="day_start">Початок (Kyiv)</Label>
          <Input
            id="day_start"
            name="day_start"
            type="time"
            defaultValue={dayStart}
            required
            className="min-h-11"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="day_end">Кінець (Kyiv)</Label>
          <Input
            id="day_end"
            name="day_end"
            type="time"
            defaultValue={dayEnd}
            required
            className="min-h-11"
            disabled={pending}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Спільні вікна рахуються лише в цих межах. Обидва учасники змінюють одні
        й ті самі межі workspace.
      </p>
      {state.message ? (
        <p
          className={
            state.ok ? "text-sm text-primary" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="min-h-11 w-full rounded-xl sm:w-auto"
        disabled={pending}
      >
        {pending ? "Збереження…" : "Зберегти межі"}
      </Button>
    </form>
  );
}

export function FinanceSettingsForm({
  action,
  splitEnabled,
  percentA,
  percentB,
  labelA,
  labelB,
  version,
}: {
  action: (
    prev: SettingsActionState | null,
    formData: FormData,
  ) => Promise<SettingsActionState>;
  splitEnabled: boolean;
  percentA: number;
  percentB: number;
  labelA: string;
  labelB: string;
  version: number;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="version" value={version} />
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="split_enabled"
          defaultChecked={splitEnabled}
          className="mt-1 size-4 accent-primary"
          disabled={pending}
        />
        <span>
          <span className="font-medium">Ділити прибуток між учасниками</span>
          <span className="mt-1 block text-muted-foreground">
            Якщо вимкнути — показуємо лише загальний прибуток бізнесу, без
            часток і виплат. Відсотки нижче підставляються в новий продаж.
          </span>
        </span>
      </label>

      <div>
        <p className="mb-2 text-sm font-medium">Розподіл за замовчуванням</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="percent_a">{labelA}, %</Label>
            <Input
              id="percent_a"
              name="percent_a"
              type="number"
              min={0}
              max={100}
              defaultValue={percentA}
              required
              className="min-h-11"
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="percent_b">{labelB}, %</Label>
            <Input
              id="percent_b"
              name="percent_b"
              type="number"
              min={0}
              max={100}
              defaultValue={percentB}
              required
              className="min-h-11"
              disabled={pending}
            />
          </div>
        </div>
        <p className="mt-2 text-sm text-primary">
          Разом: {percentA + percentB}% (перевірте перед збереженням)
        </p>
      </div>

      {state.message ? (
        <p
          className={
            state.ok ? "text-sm text-primary" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="min-h-11 rounded-xl"
        disabled={pending}
      >
        {pending ? "Збереження…" : "Зберегти правило"}
      </Button>
    </form>
  );
}

export function RatingSettingsForm({
  action,
  ratingEnabled,
  weights,
  labels,
  version,
}: {
  action: (
    prev: SettingsActionState | null,
    formData: FormData,
  ) => Promise<SettingsActionState>;
  ratingEnabled: boolean;
  weights: Record<string, number>;
  labels: Record<string, string>;
  version: number;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="version" value={version} />
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="rating_enabled"
          defaultChecked={ratingEnabled}
          className="mt-1 size-4 accent-primary"
          disabled={pending}
        />
        <span className="font-medium">Рахувати рейтинг</span>
      </label>

      <ul className="flex flex-col gap-2.5">
        {Object.entries(labels).map(([key, label]) => (
          <li
            key={key}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <Label htmlFor={`weight_${key}`} className="flex-1 font-normal">
              {label}
            </Label>
            <Input
              id={`weight_${key}`}
              name={`weight_${key}`}
              type="number"
              min={0}
              max={100}
              defaultValue={weights[key] ?? 0}
              className="min-h-10 w-20"
              disabled={pending}
            />
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Нова вага діє лише на нові дії. Старі бали не перераховуються.
      </p>

      {state.message ? (
        <p
          className={
            state.ok ? "text-sm text-primary" : "text-sm text-destructive"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 rounded-xl"
          disabled={pending}
        >
          {pending ? "Збереження…" : "Зберегти"}
        </Button>
        <Button
          type="submit"
          name="reset_defaults"
          value="1"
          variant="secondary"
          size="lg"
          className="min-h-11 rounded-xl"
          disabled={pending}
        >
          Скинути до початкових
        </Button>
      </div>
    </form>
  );
}
