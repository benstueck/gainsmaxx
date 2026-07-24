import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function Root() {
  const user = await getCurrentUser();
  redirect(user ? "/feed" : "/login");
}
