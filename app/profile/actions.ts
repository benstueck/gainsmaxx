"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  updateDefaultBaseline,
  updateHandicap,
  updateUsername,
} from "@/lib/db/queries";

export type SettingsState = { error?: string; message?: string };

function afterProfileChange() {
  // Handicap/baseline affect SG everywhere; keep server-rendered pages fresh.
  revalidatePath("/profile");
  revalidatePath("/feed");
}

export async function updateHandicapAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const raw = String(formData.get("handicap") ?? "").trim();
  const value = Number(raw);
  if (!raw || Number.isNaN(value) || value < 0 || value > 54) {
    return { error: "Enter a handicap index between 0 and 54." };
  }
  await updateHandicap(user.id, value.toFixed(1));
  afterProfileChange();
  return { message: "Handicap updated." };
}

export async function updateUsernameAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const username = String(formData.get("username") ?? "").trim();
  await updateUsername(user.id, username);
  afterProfileChange();
  return { message: "Username updated." };
}

export async function updateDefaultBaselineAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const value = String(formData.get("baseline") ?? "handicap");
  await updateDefaultBaseline(user.id, value);
  afterProfileChange();
  return { message: "Default baseline updated." };
}

export async function updateEmailAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireUser();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter an email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { error: error.message };

  afterProfileChange();
  return {
    message:
      "Email updated. If confirmation is required, check your new inbox.",
  };
}

export async function updatePasswordAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { message: "Password updated." };
}
