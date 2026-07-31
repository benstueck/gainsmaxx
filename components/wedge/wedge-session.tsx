"use client";

import { useRef, useState, useTransition } from "react";
import { X, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { BigButton } from "@/components/ui/big-button";
import { GuardedLink } from "@/components/shell/guarded-link";
import { finishWedgeSession, saveWedgeSession } from "@/app/wedgemaxx/actions";
import { nextTarget, scoreShot, sessionSummary } from "@/lib/wedge";
import type { WedgeShot } from "@/lib/wedge";

export function WedgeSession({
  sessionId,
  ballCount,
  minDistance,
  maxDistance,
  initialShots,
}: {
  sessionId: string;
  ballCount: number;
  minDistance: number;
  maxDistance: number;
  initialShots: WedgeShot[];
}) {
  const [shots, setShots] = useState<WedgeShot[]>(initialShots);
  const [carry, setCarry] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [, startSave] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // The pending target lives in client state and is only persisted once the
  // ball is logged. A reload therefore re-rolls it — acceptable for a
  // practice drill, and far simpler than reserving a target server-side.
  const [target, setTarget] = useState(() =>
    nextTarget(
      minDistance,
      maxDistance,
      initialShots.at(-1)?.targetDistance ?? null,
    ),
  );

  const summary = sessionSummary(shots);
  const done = shots.length >= ballCount;
  const ballNumber = Math.min(shots.length + 1, ballCount);

  function record(carryDistance: number | null) {
    if (done) return;
    const updated = [...shots, { targetDistance: target, carryDistance }];
    setShots(updated);
    setCarry("");
    setTarget(nextTarget(minDistance, maxDistance, target));
    startSave(() => {
      void saveWedgeSession(sessionId, updated, 0);
    });
    inputRef.current?.focus();
  }

  function submitCarry() {
    const value = Number(carry);
    if (!carry.trim() || Number.isNaN(value) || value < 0) return;
    record(Math.round(value));
  }

  async function onFinish() {
    setFinishing(true);
    try {
      await finishWedgeSession(sessionId, shots, 0);
    } catch (err) {
      // A successful finish redirects, which Next throws as NEXT_REDIRECT.
      const digest = (err as { digest?: string })?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      setFinishing(false);
    }
  }

  return (
    // min-h-dvh, not min-h-full: body's height is auto (it only has
    // min-height:100%), so a percentage min-height on a child can't resolve
    // and the container collapses to content height — leaving the entry dock
    // floating mid-screen instead of pinned to the bottom.
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        {/* Exiting is safe offline: everything entered is already saved, and
            the session list is the app's home for this mode. */}
        <GuardedLink
          href="/wedgemaxx"
          aria-label="Exit session"
          skipGuard
          className="p-2 text-muted"
        >
          <X size={24} />
        </GuardedLink>
        <div className="text-center">
          <div className="text-sm font-semibold">
            Ball {ballNumber} of {ballCount}
          </div>
          <div className="text-xs text-muted tabular-nums">
            {summary.ballsHit > 0
              ? `Avg ${summary.averagePoints.toFixed(1)} pts`
              : `${minDistance}–${maxDistance} yd`}
          </div>
        </div>
        <span className="w-9" aria-hidden />
      </header>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-semibold">All {ballCount} balls hit</p>
          <p className="text-5xl font-bold tabular-nums">
            {summary.averagePoints.toFixed(1)}
          </p>
          <p className="text-sm text-muted">average points</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
          <span className="text-sm font-medium text-muted">Hit it</span>
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-bold tabular-nums">{target}</span>
            <span className="text-2xl font-semibold text-muted">yds</span>
          </div>
        </div>
      )}

      {/* Shot list */}
      {shots.length > 0 && (
        <div className="max-h-52 overflow-y-auto border-t border-border px-4">
          <ul className="flex flex-col">
            {shots
              .map((s, i) => ({ result: scoreShot(s), index: i }))
              .reverse()
              .map(({ result, index }) => (
                <li
                  key={index}
                  className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-xs font-bold text-muted tabular-nums">
                      {index + 1}
                    </span>
                    <span className="tabular-nums">
                      {result.targetDistance} yd
                    </span>
                    <span className="text-muted">→</span>
                    {result.isMishit ? (
                      <span className="font-semibold text-negative">
                        Mishit
                      </span>
                    ) : (
                      <span className="tabular-nums">
                        {result.carryDistance} yd
                        <span
                          className={cn(
                            "ml-1 text-xs font-semibold",
                            result.deltaYd === 0
                              ? "text-muted"
                              : "text-foreground",
                          )}
                        >
                          ({result.deltaYd! > 0 ? "+" : ""}
                          {result.deltaYd})
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {result.points.toFixed(0)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Entry dock */}
      <div className="shrink-0 border-t border-border bg-background px-4 pb-safe pt-3">
        {done ? (
          <div className="pb-3">
            <BigButton block onClick={onFinish} disabled={finishing}>
              <Flag size={20} /> {finishing ? "Finishing…" : "Finish session"}
            </BigButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-3">
            <input
              ref={inputRef}
              autoFocus
              type="number"
              inputMode="numeric"
              value={carry}
              onChange={(e) => setCarry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCarry();
              }}
              placeholder="Carry distance"
              className="h-16 w-full rounded-app border border-border bg-background px-4 text-center text-3xl font-bold tabular-nums"
            />
            <div className="flex gap-2">
              <BigButton variant="secondary" onClick={() => record(null)}>
                Mishit
              </BigButton>
              <BigButton block disabled={!carry.trim()} onClick={submitCarry}>
                Log ball
              </BigButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
