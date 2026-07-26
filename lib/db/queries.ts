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

/** Persist first-run onboarding: username + handicap + units. */
export async function completeOnboarding(
  userId: string,
  data: { username: string; handicap: string; units: string },
): Promise<void> {
  const db = getDb();
  await db
    .update(profiles)
    .set({
      username: data.username,
      handicap: data.handicap,
      units: data.units,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));
}

/** Update the user's handicap index (re-interpolates baselines everywhere). */
export async function updateHandicap(
  userId: string,
  handicap: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(profiles)
    .set({ handicap, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}

/** Update the display username. */
export async function updateUsername(
  userId: string,
  username: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(profiles)
    .set({ username, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}

/** Update the preferred default SG baseline ("handicap" | "tour" | "0".."25"). */
export async function updateDefaultBaseline(
  userId: string,
  defaultBaseline: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(profiles)
    .set({ defaultBaseline, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}
