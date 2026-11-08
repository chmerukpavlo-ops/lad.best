"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

import type { AdActionState, ListingOption, WorkspaceMemberOption } from "@/lib/ads/types";
import {
  OFFLINE_SAVE_MESSAGE,
  useOnlineStatus,
} from "@/lib/listings/use-online-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: AdActionState = {
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

type AdPaymentCreateFormProps = {
  action: (
    prev: AdActionState | null,
    formData: FormData,
  ) => Promise<AdActionState>;
  listings: ListingOption[];
  members: WorkspaceMemberOption[];
  defaultListingId?: string;
  defaultPayerId: string;
};

export function AdPaymentCreateForm({
  action,
  listings,
  members,
  defaultListingId,
  defaultPayerId,
}: AdPaymentCreateFormProps) {
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const amountId = useId();

  const messageClass =
    state.code === "conflict"
      ? "text-sm text-amber-300"
      : state.ok
        ? "text-sm text-primary"
        : "text-sm text-destructive";

  return (
    <form
      action={online ? formAction : undefined}
      onSubmit={(event) => {
        if (!online) {
          event.preventDefault();
        }
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

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={amountId}>Сума, ₴</Label>
        <Input
          id={amountId}
          name="amount"
          inputMode="decimal"
          required
          placeholder="0.00"
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="paid_on">Фактична дата платежу</Label>
        <Input
          id="paid_on"
          name="paid_on"
          type="date"
          required
          defaultValue={todayKyivDateString()}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="payer_id">Хто заплатив</Label>
        <select
          id="payer_id"
          name="payer_id"
          required
          defaultValue={defaultPayerId}
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
        <Label htmlFor="note">Примітка (необов’язково)</Label>
        <Textarea
          id="note"
          name="note"
          maxLength={4000}
          className="min-h-20 rounded-xl"
          disabled={pending || !online}
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

      <Button
        type="submit"
        size="lg"
        className="min-h-11 w-full rounded-xl text-base"
        disabled={pending || !online || listings.length === 0}
      >
        {pending ? "Збереження…" : "Додати платіж"}
      </Button>
    </form>
  );
}

type AdPaymentCorrectFormProps = {
  action: (
    prev: AdActionState | null,
    formData: FormData,
  ) => Promise<AdActionState>;
  paymentId: string;
  version: number;
  members: WorkspaceMemberOption[];
  values: {
    amount: string;
    paid_on: string;
    payer_id: string;
    note: string | null;
    status: "valid" | "void";
  };
};

export function AdPaymentCorrectForm({
  action,
  paymentId,
  version,
  members,
  values,
}: AdPaymentCorrectFormProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
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
      onSubmit={(event) => {
        if (!online) {
          event.preventDefault();
        }
      }}
      className="flex w-full min-w-0 flex-col gap-5"
    >
      <input type="hidden" name="id" value={paymentId} />
      <input type="hidden" name="version" value={String(version)} />

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="amount">Сума, ₴</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          required
          defaultValue={values.amount}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="paid_on">Фактична дата платежу</Label>
        <Input
          id="paid_on"
          name="paid_on"
          type="date"
          required
          defaultValue={values.paid_on}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="payer_id">Хто заплатив</Label>
        <select
          id="payer_id"
          name="payer_id"
          required
          defaultValue={values.payer_id}
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
        <Label htmlFor="status">Стан</Label>
        <select
          id="status"
          name="status"
          required
          defaultValue={values.status}
          disabled={pending || !online}
          className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
        >
          <option value="valid">Дійсний</option>
          <option value="void">Анульований (помилка запису)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Анульований платіж не входить у суму реклами оголошення. Фізичного
          видалення немає.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="note">Примітка</Label>
        <Textarea
          id="note"
          name="note"
          maxLength={4000}
          defaultValue={values.note ?? ""}
          className="min-h-20 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="correction_reason">Причина виправлення</Label>
        <Textarea
          id="correction_reason"
          name="correction_reason"
          required
          maxLength={2000}
          className="min-h-20 rounded-xl"
          disabled={pending || !online}
          placeholder="Обов’язково — що саме виправляєте і чому"
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
        {pending ? "Збереження…" : "Зберегти виправлення"}
      </Button>
    </form>
  );
}
