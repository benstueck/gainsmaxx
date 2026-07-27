import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/db/queries";
import { loadUserRounds } from "@/lib/db/round-queries";
import { resolveBaseline } from "@/lib/baseline";
import { computeCareerStats } from "@/lib/career-stats";
import { careerBucketTotals } from "@/lib/round-stats";
import { signOutAction } from "@/app/auth/actions";
import { BigButton } from "@/components/ui/big-button";
import { AdvancedStatsSection } from "@/components/stats/advanced-stats";
import {
  PasswordForm,
  ProfileSettingsForm,
} from "@/components/profile/settings-forms";
import type { SgCategory } from "@/lib/sg";

const CATEGORY_LABEL: Record<SgCategory, string> = {
  ott: "OTT",
  app: "APP",
  arg: "ARG",
  putt: "PUTT",
};
const CATEGORY_ORDER: SgCategory[] = ["ott", "app", "arg", "putt"];

const fmtSg = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const handicap = profile?.handicap != null ? Number(profile.handicap) : null;
  const defaultBaseline = profile?.defaultBaseline ?? "handicap";
  const baseline = resolveBaseline(defaultBaseline, handicap);

  const rounds = await loadUserRounds(user.id, baseline);
  const stats = computeCareerStats(rounds);
  const bucketTotals = careerBucketTotals(
    rounds.map((r) => ({
      status: r.status,
      holesPlayed: r.summary.holesPlayed,
      holes: r.holes,
    })),
  );

  return (
    <main className="mx-auto w-full max-w-md px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {profile?.username || "Profile"}
      </h1>
      {profile?.username && <p className="text-sm text-muted">{user.email}</p>}

      {/* Career stats */}
      <section className="mt-5 rounded-app border border-border p-4">
        <h2 className="text-sm font-semibold text-muted">Your game</h2>
        {stats.roundsPlayed === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Finish a round to see your career strokes gained.
          </p>
        ) : (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-4xl font-bold tabular-nums ${
                  stats.avgTotal >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {fmtSg(stats.avgTotal)}
              </span>
              <span className="text-sm text-muted">avg SG / 18</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {stats.roundsPlayed} round{stats.roundsPlayed === 1 ? "" : "s"}{" "}
              played
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {CATEGORY_ORDER.map((c) => (
                <div key={c} className="text-center">
                  <div className="text-xs font-semibold text-muted">
                    {CATEGORY_LABEL[c]}
                  </div>
                  <div
                    className={`text-sm font-bold tabular-nums ${
                      stats.avgByCategory[c] >= 0
                        ? "text-positive"
                        : "text-negative"
                    }`}
                  >
                    {fmtSg(stats.avgByCategory[c])}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {stats.roundsPlayed > 0 && (
        <AdvancedStatsSection buckets={bucketTotals} valueLabel="Avg SG / 18" />
      )}

      {/* Profile settings */}
      <section className="mt-6">
        <h2 className="mb-1 text-sm font-semibold text-muted">Profile</h2>
        <div className="rounded-app border border-border p-4">
          {/* Keyed by the current server values so a save re-syncs these
              uncontrolled fields immediately instead of showing a stale
              value for one render after the server action refresh. */}
          <ProfileSettingsForm
            key={`${handicap}-${defaultBaseline}-${profile?.username}-${user.email}`}
            handicap={handicap}
            defaultBaseline={defaultBaseline}
            username={profile?.username ?? null}
            email={user.email ?? ""}
          />
        </div>
      </section>

      {/* Password */}
      <section className="mt-6">
        <h2 className="mb-1 text-sm font-semibold text-muted">Password</h2>
        <div className="rounded-app border border-border p-4">
          <PasswordForm />
        </div>
      </section>

      <form action={signOutAction} className="mt-6">
        <BigButton type="submit" variant="secondary" block>
          Log out
        </BigButton>
      </form>
    </main>
  );
}
