import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ensureProfile } from "@/lib/db/queries";
import { TabBar } from "@/components/shell/tab-bar";

/**
 * Authenticated app shell. Guards every child route: requires a session, ensures
 * a profile exists, and routes to onboarding until a handicap is set. Renders the
 * persistent 3-tab bottom bar.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const profile = await ensureProfile(user.id);
  if (profile.handicap == null) redirect("/nux");

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 pb-24">{children}</div>
      <TabBar />
    </div>
  );
}
