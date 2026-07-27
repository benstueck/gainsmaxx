"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUniqueViolation, isValidEmail } from "@/lib/validation";
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

/** Saves handicap, default baseline, username, and email together. */
export async function updateProfileAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();

  const handicapRaw = String(formData.get("handicap") ?? "").trim();
  const handicapValue = Number(handicapRaw);
  if (
    !handicapRaw ||
    Number.isNaN(handicapValue) ||
    handicapValue < 0 ||
    handicapValue > 54
  ) {
    return { error: "Enter a handicap index between 0 and 54." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter an email address." };
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };

  const username = String(formData.get("username") ?? "").trim();
  const baseline = String(formData.get("baseline") ?? "handicap");

  await updateHandicap(user.id, handicapValue.toFixed(1));
  try {
    await updateUsername(user.id, username);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "That username is already taken." };
    }
    throw err;
  }
  await updateDefaultBaseline(user.id, baseline);

  if (email !== user.email) {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ email });
    if (error) return { error: error.message };
  }

  afterProfileChange();
  return { message: "Profile updated." };
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
