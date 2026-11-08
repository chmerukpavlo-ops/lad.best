"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_PATHS,
  passwordRecoveryRedirectTo,
  safeAppOrigin,
  safeAuthNextPath,
} from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  ok: boolean;
  message: string;
};

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInWithPassword(
  _prev: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const nextRaw = formString(formData, "next");

  if (!email || !password) {
    return { ok: false, message: "Вкажіть email і пароль." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      ok: false,
      message: "Невірний email або пароль, або доступ заборонено.",
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Не вдалося підтвердити сесію. Спробуйте ще раз.",
    };
  }

  redirect(safeAuthNextPath(nextRaw, AUTH_PATHS.app));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`${AUTH_PATHS.login}?signed_out=1`);
}

export async function requestPasswordReset(
  _prev: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formString(formData, "email");
  if (!email) {
    return { ok: false, message: "Вкажіть email." };
  }

  const headerStore = await headers();
  const origin = safeAppOrigin(
    headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL,
  );

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: passwordRecoveryRedirectTo(origin),
  });

  if (error) {
    return {
      ok: false,
      message:
        "Не вдалося надіслати лист відновлення. Перевірте email або спробуйте пізніше.",
    };
  }

  return {
    ok: true,
    message:
      "Якщо цей email має доступ, ми надіслали посилання для відновлення пароля.",
  };
}

export async function updatePassword(
  _prev: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const password = formString(formData, "password");
  const confirm = formString(formData, "confirm");

  if (password.length < 8) {
    return { ok: false, message: "Пароль має містити щонайменше 8 символів." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Паролі не збігаються." };
  }

  const supabase = await createClient();
  // Auth-server confirmation (not getSession / claims-only).
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      ok: false,
      message:
        "Сесія відновлення відсутня або прострочена. Запросіть нове посилання.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      ok: false,
      message:
        "Не вдалося оновити пароль. Посилання могло прострочитись — запросіть нове.",
    };
  }

  redirect(AUTH_PATHS.app);
}
