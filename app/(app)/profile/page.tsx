import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/db/queries";
import { signOutAction } from "@/app/auth/actions";
import { BigButton } from "@/components/ui/big-button";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-4">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <main className="mx-auto w-full max-w-md px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>

      <div className="mt-6">
        <Row label="Email" value={user.email ?? "—"} />
        <Row label="Handicap index" value={profile?.handicap ?? "—"} />
        <Row label="Units" value="Yards & feet" />
      </div>

      <p className="mt-6 text-sm text-muted">
        Career stats and editable settings are coming in a later milestone.
      </p>

      <form action={signOutAction} className="mt-8">
        <BigButton type="submit" variant="secondary" block>
          Log out
        </BigButton>
      </form>
    </main>
  );
}
