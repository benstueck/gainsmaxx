import { redirect } from "next/navigation";
import { getCurrentUser } from "./supabase/server";

/** Return the authenticated user, or redirect to /login if there is none. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
