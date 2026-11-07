"use client";

import { useActionState } from "react";

import type { AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { ok: false, message: "" };

type Field = {
  name: string;
  label: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
};

type AuthFormProps = {
  action: (
    prev: AuthActionState | null,
    formData: FormData,
  ) => Promise<AuthActionState>;
  fields: Field[];
  submitLabel: string;
  hiddenFields?: Record<string, string>;
  successRedirectHint?: string;
};

export function AuthForm({
  action,
  fields,
  submitLabel,
  hiddenFields,
  successRedirectHint,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}

      {fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            required={field.required ?? true}
            className="min-h-11"
            disabled={pending}
          />
        </div>
      ))}

      {state.message ? (
        <p
          className={
            state.ok
              ? "text-sm text-primary"
              : "text-sm text-destructive"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      {state.ok && successRedirectHint ? (
        <p className="text-sm text-muted-foreground">{successRedirectHint}</p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="min-h-11 w-full text-base"
        disabled={pending}
      >
        {pending ? "Зачекайте…" : submitLabel}
      </Button>
    </form>
  );
}
