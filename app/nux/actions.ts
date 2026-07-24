"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { completeOnboarding } from "@/lib/db/queries";

export type NuxState = { error?: string };

export async function completeOnboardingAction(
  _prev: NuxState,
  formData: FormData,
): Promise<NuxState> {
  const user = await requireUser();
  const raw = String(formData.get("handicap") ?? "").trim();
  const value = Number(raw);
  if (!raw || Number.isNaN(value) || value < 0 || value > 54) {
    return { error: "Enter a handicap index between 0 and 54." };
  }
  await completeOnboarding(user.id, {
    handicap: value.toFixed(1),
    units: "imperial",
  });
  redirect("/feed");
}
