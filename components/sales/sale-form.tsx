"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ListingOption, WorkspaceMemberOption } from "@/lib/ads/types";
import type { SaleActionState } from "@/lib/sales/types";
import {
  OFFLINE_SAVE_MESSAGE,
  useOnlineStatus,
} from "@/lib/listings/use-online-status";
import {
  computeMarginKopiyky,
  formatUahDisplay,
  parseUahToKopiyky,
} from "@/lib/money/kopiyky";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: SaleActionState = {
  ok: false,
  code: "ok",
  message: "",
};

function todayKyivDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type SharedFieldsProps = {
  members: WorkspaceMemberOption[];
  defaultExecutorId: string;
  values?: {
    sale_price?: string;
    cost_price?: string;
    direct_expenses?: string;
    color_text?: string | null;
    size_text?: string | null;
    note?: string | null;
    sold_on?: string;
  };
  pending: boolean;
  online: boolean;
  showMarginPreview?: boolean;
};

function SharedSaleFields({
  members,
  defaultExecutorId,
  values,
  pending,
  online,
  showMarginPreview = true,
}: SharedFieldsProps) {
  const [salePrice, setSalePrice] = useState(values?.sale_price ?? "");
  const [costPrice, setCostPrice] = useState(values?.cost_price ?? "");
  const [expenses, setExpenses] = useState(values?.direct_expenses ?? "0");

  const marginPreview = useMemo(() => {
    const p = parseUahToKopiyky(salePrice);
    const c = parseUahToKopiyky(costPrice || "0");
    const e = parseUahToKopiyky(expenses.trim() === "" ? "0" : expenses);
    if (!p.ok || !c.ok || !e.ok) return null;
    return computeMarginKopiyky(p.kopiyky, c.kopiyky, e.kopiyky);
  }, [salePrice, costPrice, expenses]);

  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="sale_price">Ціна продажу, ₴</Label>
        <Input
          id="sale_price"
          name="sale_price"
          inputMode="decimal"
          required
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="cost_price">Закупівля, ₴</Label>
        <Input
          id="cost_price"
          name="cost_price"
          inputMode="decimal"
          required
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="direct_expenses">Прямі витрати, ₴</Label>
        <Input
          id="direct_expenses"
          name="direct_expenses"
          inputMode="decimal"
          value={expenses}
          onChange={(e) => setExpenses(e.target.value)}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
        <p className="text-xs text-muted-foreground">
          Доставка, пакування тощо. Реклама сюди не входить.
        </p>
      </div>

      {showMarginPreview && marginPreview != null ? (
        <p className="text-sm text-muted-foreground">
          Маржа до реклами:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatUahDisplay(marginPreview)}
          </span>
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="sold_on">Бізнес-дата продажу</Label>
        <Input
          id="sold_on"
          name="sold_on"
          type="date"
          required
          defaultValue={values?.sold_on ?? todayKyivDateString()}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="executor_id">Виконавець</Label>
        <select
          id="executor_id"
          name="executor_id"
          required
          defaultValue={defaultExecutorId}
          disabled={pending || !online}
          className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
        >
          {members.map((member) => (
            <option key={member.profile_id} value={member.profile_id}>
              {member.display_name?.trim() || "Учасник"}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="color_text">Колір (текст)</Label>
        <Input
          id="color_text"
          name="color_text"
          maxLength={200}
          defaultValue={values?.color_text ?? ""}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="size_text">Розмір</Label>
        <Input
          id="size_text"
          name="size_text"
          maxLength={100}
          defaultValue={values?.size_text ?? ""}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="note">Примітка</Label>
        <Textarea
          id="note"
          name="note"
          maxLength={4000}
          defaultValue={values?.note ?? ""}
          className="min-h-20 rounded-xl"
          disabled={pending || !online}
        />
      </div>
    </>
  );
}

type CreateProps = {
  action: (
    prev: SaleActionState | null,
    formData: FormData,
  ) => Promise<SaleActionState>;
  listings: ListingOption[];
  members: WorkspaceMemberOption[];
  defaultListingId?: string;
  defaultExecutorId: string;
  splitDefaults?: {
    enabled: boolean;
    percentA: number;
    percentB: number;
    labelA: string;
    labelB: string;
  } | null;
};

export function SaleCreateForm({
  action,
  listings,
  members,
  defaultListingId,
  defaultExecutorId,
  splitDefaults,
}: CreateProps) {
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientRequestId] = useState(() => crypto.randomUUID());

  const messageClass = state.ok
    ? "text-sm text-primary"
    : "text-sm text-destructive";

  return (
    <form
      action={online ? formAction : undefined}
      onSubmit={(e) => {
        if (!online) e.preventDefault();
      }}
      className="flex w-full min-w-0 flex-col gap-5"
    >
      <input type="hidden" name="client_request_id" value={clientRequestId} />

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="listing_id">Оголошення</Label>
        <select
          id="listing_id"
          name="listing_id"
          required
          defaultValue={defaultListingId ?? ""}
          disabled={pending || !online || listings.length === 0}
          className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
        >
          <option value="" disabled>
            Оберіть оголошення
          </option>
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.title}
              {listing.status === "archived" ? " (архів)" : ""}
            </option>
          ))}
        </select>
      </div>

      <SharedSaleFields
        members={members}
        defaultExecutorId={defaultExecutorId}
        pending={pending}
        online={online}
      />

      {splitDefaults ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="split_enabled"
              defaultChecked={splitDefaults.enabled}
              className="mt-1 size-4 accent-primary"
              disabled={pending || !online}
            />
            <span>
              <span className="font-medium">Ділити прибуток</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Знімок для цього продажу (без виплат). За замовчуванням з
                налаштувань.
              </span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="percent_a">{splitDefaults.labelA}, %</Label>
              <Input
                id="percent_a"
                name="percent_a"
                type="number"
                min={0}
                max={100}
                defaultValue={splitDefaults.percentA}
                className="min-h-11"
                disabled={pending || !online}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="percent_b">{splitDefaults.labelB}, %</Label>
              <Input
                id="percent_b"
                name="percent_b"
                type="number"
                min={0}
                max={100}
                defaultValue={splitDefaults.percentB}
                className="min-h-11"
                disabled={pending || !online}
              />
            </div>
          </div>
        </div>
      ) : null}

      {!online ? (
        <p className="text-sm text-destructive" role="alert">
          {OFFLINE_SAVE_MESSAGE}
        </p>
      ) : null}
      {online && state.message ? (
        <p className={messageClass} role="status">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="min-h-11 w-full rounded-xl text-base"
        disabled={pending || !online || listings.length === 0}
      >
        {pending ? "Збереження…" : "Створити продаж"}
      </Button>
    </form>
  );
}

type EditProps = {
  action: (
    prev: SaleActionState | null,
    formData: FormData,
  ) => Promise<SaleActionState>;
  saleId: string;
  version: number;
  members: WorkspaceMemberOption[];
  values: {
    sale_price: string;
    cost_price: string;
    direct_expenses: string;
    color_text: string | null;
    size_text: string | null;
    note: string | null;
    sold_on: string;
    executor_id: string;
  };
};

export function SaleEditForm({
  action,
  saleId,
  version,
  members,
  values,
}: EditProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, state.message, router]);

  const messageClass =
    state.code === "conflict"
      ? "text-sm text-amber-300"
      : state.ok
        ? "text-sm text-primary"
        : "text-sm text-destructive";

  return (
    <form
      action={online ? formAction : undefined}
      onSubmit={(e) => {
        if (!online) e.preventDefault();
      }}
      className="flex w-full min-w-0 flex-col gap-5"
    >
      <input type="hidden" name="id" value={saleId} />
      <input type="hidden" name="version" value={String(version)} />

      <SharedSaleFields
        members={members}
        defaultExecutorId={values.executor_id}
        values={values}
        pending={pending}
        online={online}
      />

      {!online ? (
        <p className="text-sm text-destructive" role="alert">
          {OFFLINE_SAVE_MESSAGE}
        </p>
      ) : null}
      {online && state.message ? (
        <p className={messageClass} role="status">
          {state.message}
        </p>
      ) : null}
      {online && state.code === "conflict" ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 rounded-xl"
          onClick={() => router.refresh()}
        >
          Оновити дані зі сервера
        </Button>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="min-h-11 w-full rounded-xl text-base"
        disabled={pending || !online}
      >
        {pending ? "Збереження…" : "Зберегти зміни"}
      </Button>
    </form>
  );
}

type CompleteProps = {
  action: (
    prev: SaleActionState | null,
    formData: FormData,
  ) => Promise<SaleActionState>;
  saleId: string;
  version: number;
  soldOn: string;
};

export function SaleCompleteForm({
  action,
  saleId,
  version,
  soldOn,
}: CompleteProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [completeRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, state.message, router]);

  const messageClass =
    state.code === "conflict"
      ? "text-sm text-amber-300"
      : state.ok
        ? "text-sm text-primary"
        : "text-sm text-destructive";

  return (
    <form
      action={online ? formAction : undefined}
      onSubmit={(e) => {
        if (!online) e.preventDefault();
      }}
      className="flex w-full min-w-0 flex-col gap-4"
    >
      <input type="hidden" name="id" value={saleId} />
      <input type="hidden" name="version" value={String(version)} />
      <input type="hidden" name="complete_request_id" value={completeRequestId} />
      <input type="hidden" name="sold_on" value={soldOn} />

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="completed_on">Дата завершення</Label>
        <Input
          id="completed_on"
          name="completed_on"
          type="date"
          required
          defaultValue={soldOn || todayKyivDateString()}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
        <p className="text-xs text-muted-foreground">
          Для підсумків періоду. Маржа = ціна − закупівля − прямі
          витрати; реклама не списується сюди.
        </p>
      </div>

      {!online ? (
        <p className="text-sm text-destructive" role="alert">
          {OFFLINE_SAVE_MESSAGE}
        </p>
      ) : null}
      {online && state.message ? (
        <p className={messageClass} role="status">
          {state.message}
        </p>
      ) : null}
      {online && state.code === "conflict" ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 rounded-xl"
          onClick={() => router.refresh()}
        >
          Оновити дані зі сервера
        </Button>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="min-h-11 w-full rounded-xl text-base"
        disabled={pending || !online}
      >
        {pending ? "Завершення…" : "Завершити продаж"}
      </Button>
    </form>
  );
}

type CancelProps = {
  action: (
    prev: SaleActionState | null,
    formData: FormData,
  ) => Promise<SaleActionState>;
  saleId: string;
  version: number;
};

export function SaleCancelForm({ action, saleId, version }: CancelProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, state.message, router]);

  return (
    <form
      action={online ? formAction : undefined}
      onSubmit={(e) => {
        if (!online) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={saleId} />
      <input type="hidden" name="version" value={String(version)} />
      {!online ? (
        <p className="text-sm text-destructive" role="alert">
          {OFFLINE_SAVE_MESSAGE}
        </p>
      ) : null}
      {online && state.message ? (
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
        variant="outline"
        size="lg"
        className="min-h-11 w-full rounded-xl"
        disabled={pending || !online}
      >
        {pending ? "Скасування…" : "Скасувати відкритий продаж"}
      </Button>
    </form>
  );
}

type CorrectProps = {
  action: (
    prev: SaleActionState | null,
    formData: FormData,
  ) => Promise<SaleActionState>;
  saleId: string;
  version: number;
  members: WorkspaceMemberOption[];
  values: {
    sale_price: string;
    cost_price: string;
    direct_expenses: string;
    color_text: string | null;
    size_text: string | null;
    note: string | null;
    sold_on: string;
    completed_on: string;
    executor_id: string;
  };
};

export function SaleCorrectForm({
  action,
  saleId,
  version,
  members,
  values,
}: CorrectProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, state.message, router]);

  const messageClass =
    state.code === "conflict"
      ? "text-sm text-amber-300"
      : state.ok
        ? "text-sm text-primary"
        : "text-sm text-destructive";

  return (
    <form
      action={online ? formAction : undefined}
      onSubmit={(e) => {
        if (!online) e.preventDefault();
      }}
      className="flex w-full min-w-0 flex-col gap-5"
    >
      <input type="hidden" name="id" value={saleId} />
      <input type="hidden" name="version" value={String(version)} />

      <SharedSaleFields
        members={members}
        defaultExecutorId={values.executor_id}
        values={values}
        pending={pending}
        online={online}
      />

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="completed_on">Дата завершення</Label>
        <Input
          id="completed_on"
          name="completed_on"
          type="date"
          required
          defaultValue={values.completed_on}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="correction_reason">Причина корекції</Label>
        <Textarea
          id="correction_reason"
          name="correction_reason"
          required
          maxLength={2000}
          className="min-h-20 rounded-xl"
          disabled={pending || !online}
          placeholder="Обов’язково — що й чому змінюєте"
        />
      </div>

      {!online ? (
        <p className="text-sm text-destructive" role="alert">
          {OFFLINE_SAVE_MESSAGE}
        </p>
      ) : null}
      {online && state.message ? (
        <p className={messageClass} role="status">
          {state.message}
        </p>
      ) : null}
      {online && state.code === "conflict" ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 rounded-xl"
          onClick={() => router.refresh()}
        >
          Оновити дані зі сервера
        </Button>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="min-h-11 w-full rounded-xl text-base"
        disabled={pending || !online}
      >
        {pending ? "Збереження…" : "Зберегти корекцію"}
      </Button>
    </form>
  );
}
