import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/db/queries";
import { loadUserRounds } from "@/lib/db/round-queries";
import { loadUserWedgeSessions } from "@/lib/db/wedge-queries";
import { loadUserPuttSessions } from "@/lib/db/putt-queries";
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
import { wedgeCareerStats } from "@/lib/wedge";
import { puttCareerStats } from "@/lib/putt";
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
  const wedgeSessions = await loadUserWedgeSessions(user.id);
  const wedge = wedgeCareerStats(wedgeSessions);
  const puttSessions = await loadUserPuttSessions(user.id);
  const putt = puttCareerStats(puttSessions);
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

      {/* --- Gainsmaxx: on-course strokes gained ------------------------- */}
      <h2 className="mt-6 text-lg font-bold tracking-tight">Gainsmaxx</h2>
      <p className="text-sm text-muted">Strokes gained tracking</p>

      <section className="mt-3 rounded-app border border-border p-4">
        {stats.roundsPlayed === 0 ? (
          <p className="text-sm text-muted">
            Finish a round to see your career strokes gained.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
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
        <div className="mt-3">
          <AdvancedStatsSection
            buckets={bucketTotals}
            valueLabel="Avg SG / 18"
          />
        </div>
      )}

      {/* --- Wedgemaxx: range distance control ---------------------------- */}
      <h2 className="mt-8 text-lg font-bold tracking-tight">Wedgemaxx</h2>
      <p className="text-sm text-muted">Practice wedge distance control</p>

      <section className="mt-3 rounded-app border border-border p-4">
        {wedge.sessionsCompleted === 0 ? (
          <p className="text-sm text-muted">
            Finish a session to see your distance-control numbers.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums">
                {wedge.averagePoints.toFixed(1)}
              </span>
              <span className="text-sm text-muted">avg points</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {wedge.sessionsCompleted} session
              {wedge.sessionsCompleted === 1 ? "" : "s"} · {wedge.ballsHit}{" "}
              balls · 100 = PGA Tour
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
              <div className="text-center">
                <div className="text-xs font-semibold text-muted">BEST</div>
                <div className="text-sm font-bold tabular-nums">
                  {wedge.bestSessionPoints?.toFixed(1) ?? "—"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-muted">BIAS</div>
                <div className="text-sm font-bold tabular-nums">
                  {`${wedge.averageBiasYd >= 0 ? "+" : "−"}${Math.abs(
                    wedge.averageBiasYd,
                  ).toFixed(1)} yd`}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-muted">MISHITS</div>
                <div className="text-sm font-bold tabular-nums">
                  {Math.round(wedge.mishitRate * 100)}%
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* --- Puttmaxx: practice-green putting ----------------------------- */}
      <h2 className="mt-8 text-lg font-bold tracking-tight">Puttmaxx</h2>
      <p className="text-sm text-muted">Practice green putting</p>

      <section className="mt-3 rounded-app border border-border p-4">
        {putt.sessionsCompleted === 0 ? (
          <p className="text-sm text-muted">
            Finish a session to see your putting numbers.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-4xl font-bold tabular-nums ${
                  putt.averageSg >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {fmtSg(putt.averageSg)}
              </span>
              <span className="text-sm text-muted">SG per putt</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {putt.sessionsCompleted} session
              {putt.sessionsCompleted === 1 ? "" : "s"} · {putt.puttsHit} putts
              · 0.00 = Tour
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
              <div className="text-center">
                <div className="text-xs font-semibold text-muted">MADE</div>
                <div className="text-sm font-bold tabular-nums">
                  {Math.round(putt.makePercent * 100)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-muted">3-PUTTS</div>
                <div className="text-sm font-bold tabular-nums">
                  {Math.round(putt.threePuttRate * 100)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-muted">BEST</div>
                <div className="text-sm font-bold tabular-nums">
                  {putt.bestSessionSg == null ? "—" : fmtSg(putt.bestSessionSg)}
                </div>
              </div>
            </div>

            {/* Career tendencies. A single session rarely has enough misses to
                clear the significance gate; pooled across sessions is where a
                real pattern shows and a fluke doesn't. Only called ones are
                listed — silence here means "nothing proven yet", which is the
                honest state most of the time. */}
            {(putt.directionBias.significant ||
              putt.readBias.significant ||
              putt.speedBias.significant) && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="text-xs font-semibold text-muted">
                  CAREER TENDENCIES
                </div>
                <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                  {putt.readBias.significant && (
                    <li>
                      Misses{" "}
                      <span className="font-semibold">
                        {putt.readBias.leaning === "low" ? "low" : "high"}
                      </span>{" "}
                      , {putt.readBias.leaning === "low" ? "under" : "over"}
                      -reading the break ({putt.readBias.n} putts)
                    </li>
                  )}
                  {putt.directionBias.significant && (
                    <li>
                      Misses{" "}
                      <span className="font-semibold">
                        {putt.directionBias.leaning}
                      </span>{" "}
                      , face or path ({putt.directionBias.n} putts)
                    </li>
                  )}
                  {putt.speedBias.significant && (
                    <li>
                      Tends{" "}
                      <span className="font-semibold">
                        {putt.speedBias.leaning}
                      </span>{" "}
                      , pace control ({putt.speedBias.n} putts)
                    </li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* --- Account ------------------------------------------------------ */}
      <section className="mt-8">
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
