"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { completeOnboarding } from "@/lib/db/queries";
import { isUniqueViolation } from "@/lib/validation";

export type NuxState = { error?: string };

export async function completeOnboardingAction(
  _prev: NuxState,
  formData: FormData,
): Promise<NuxState> {
  const user = await requireUser();

  const username = String(formData.get("username") ?? "").trim();
  if (!username) {
    return { error: "Enter a username." };
  }

  const raw = String(formData.get("handicap") ?? "").trim();
  const value = Number(raw);
  if (!raw || Number.isNaN(value) || value < 0 || value > 54) {
    return { error: "Enter a handicap index between 0 and 54." };
  }

  try {
    await completeOnboarding(user.id, {
      username,
      handicap: value.toFixed(1),
      units: "imperial",
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "That username is already taken." };
    }
    throw err;
  }
  redirect("/feed");
}
