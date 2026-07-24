import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/db/queries";
import { NuxForm } from "./nux-form";

export default async function NuxPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  // Already onboarded → straight to the app.
  if (profile?.handicap != null) redirect("/feed");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <NuxForm />
    </main>
  );
}
