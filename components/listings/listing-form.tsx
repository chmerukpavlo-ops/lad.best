"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import type { ListingActionState } from "@/lib/listings/types";
import {
  OFFLINE_SAVE_MESSAGE,
  useOnlineStatus,
} from "@/lib/listings/use-online-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ListingActionState = {
  ok: false,
  code: "ok",
  message: "",
};

type ListingFormValues = {
  title?: string;
  brand?: string | null;
  list_price?: string | null;
  colors_text?: string | null;
  description?: string | null;
  notes?: string | null;
  publication_url?: string | null;
};

type ListingFormProps = {
  mode: "create" | "edit";
  action: (
    prev: ListingActionState | null,
    formData: FormData,
  ) => Promise<ListingActionState>;
  values?: ListingFormValues;
  listingId?: string;
  version?: number;
  submitLabel: string;
};

export function ListingForm({
  mode,
  action,
  values,
  listingId,
  version,
  submitLabel,
}: ListingFormProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [state, formAction, pending] = useActionState(action, initialState);

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
      {mode === "edit" && listingId != null && version != null ? (
        <>
          <input type="hidden" name="id" value={listingId} />
          <input type="hidden" name="version" value={String(version)} />
        </>
      ) : null}

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="title">Назва</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={values?.title ?? ""}
          maxLength={200}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
          aria-invalid={state.code === "validation" && !state.ok}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="brand">Бренд (необовʼязково)</Label>
          <Input
            id="brand"
            name="brand"
            defaultValue={values?.brand ?? ""}
            maxLength={120}
            className="min-h-11 rounded-xl"
            disabled={pending || !online}
            placeholder="Nike, Adidas…"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="list_price">Ціна орієнтовна (необовʼязково)</Label>
          <Input
            id="list_price"
            name="list_price"
            inputMode="decimal"
            defaultValue={values?.list_price ?? ""}
            className="min-h-11 rounded-xl"
            disabled={pending || !online}
            placeholder="3200"
          />
          <p className="text-xs text-muted-foreground">
            Орієнтир у колажі, не ціна продажу.
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="colors_text">Кольори (текстом)</Label>
        <Textarea
          id="colors_text"
          name="colors_text"
          defaultValue={values?.colors_text ?? ""}
          maxLength={4000}
          className="min-h-24 rounded-xl"
          disabled={pending || !online}
          placeholder="Наприклад: чорний, білий, сірий…"
        />
        <p className="text-xs text-muted-foreground">
          Одна модель — багато кольорів у тексті, без окремого каталогу.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="description">Опис</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={values?.description ?? ""}
          maxLength={8000}
          className="min-h-24 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="notes">Примітки</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={values?.notes ?? ""}
          maxLength={8000}
          className="min-h-20 rounded-xl"
          disabled={pending || !online}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="publication_url">Посилання на публікацію</Label>
        <Input
          id="publication_url"
          name="publication_url"
          type="url"
          inputMode="url"
          defaultValue={values?.publication_url ?? ""}
          maxLength={2000}
          className="min-h-11 rounded-xl"
          disabled={pending || !online}
          placeholder="https://…"
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
        {pending ? "Збереження…" : submitLabel}
      </Button>
    </form>
  );
}
