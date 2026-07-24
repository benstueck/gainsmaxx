import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { profiles, type Profile } from "./schema";

/** Fetch a user's profile row, or null if it doesn't exist yet. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Ensure a profile row exists for the user (the signup trigger normally creates
 * it; this backstops any gaps). Returns the profile.
 */
export async function ensureProfile(userId: string): Promise<Profile> {
  const existing = await getProfile(userId);
  if (existing) return existing;
  const db = getDb();
  await db.insert(profiles).values({ id: userId }).onConflictDoNothing();
  return (await getProfile(userId))!;
}

/** Persist first-run onboarding: handicap + units. */
export async function completeOnboarding(
  userId: string,
  data: { handicap: string; units: string },
): Promise<void> {
  const db = getDb();
  await db
    .update(profiles)
    .set({ handicap: data.handicap, units: data.units, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}
