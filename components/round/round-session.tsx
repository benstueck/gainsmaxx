"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { GuardedLink } from "@/components/shell/guarded-link";
import {
  X,
  Undo2,
  Flag,
  ChevronLeft,
  ChevronRight,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BigButton } from "@/components/ui/big-button";
import { NumericKeypad } from "@/components/round/numeric-keypad";
import {
  holeShotInputs,
  isHoleComplete,
  makeHole,
  nextStart,
  startForIndex,
  unitFor,
  type HoleState,
  type ShotEnd,
} from "@/lib/round";
import {
  holeStrokesGained,
  roundStrokesGained,
  strokesGainedForShot,
  type Baseline,
  type Lie,
} from "@/lib/sg";
import { finishRound, saveRound } from "@/app/round/actions";
import { getDraft, putDraft, clearDraft } from "@/lib/offline/round-sync";

/** Next.js encodes a successful redirect() as a thrown "NEXT_REDIRECT" digest
 *  rather than a normal return — distinguish that from a real sync failure. */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

const END_LIES: Lie[] = ["fairway", "rough", "sand", "recovery", "green"];
const LIE_LABEL: Record<Lie, string> = {
  tee: "Tee",
  fairway: "Fairway",
  rough: "Rough",
  sand: "Sand",
  recovery: "Recovery",
  green: "Green",
};

type Draft = {
  endLie: Lie | null;
  distance: string;
  penalty: number;
  editing: number | null;
};

type State = { holes: HoleState[]; current: number; draft: Draft };

const EMPTY_DRAFT: Draft = {
  endLie: null,
  distance: "",
  penalty: 0,
  editing: null,
};

type Action =
  | { type: "setPar"; par: number }
  | { type: "setLength" }
  | { type: "pickLie"; lie: Lie }
  | { type: "digit"; d: string }
  | { type: "backspace" }
  | { type: "setPenalty"; value: number }
  | { type: "addShot" }
  | { type: "holeOut" }
  | { type: "undo" }
  | { type: "editShot"; index: number }
  | { type: "deleteShot"; index: number }
  | { type: "nextHole"; numHoles: number }
  | { type: "goToHole"; index: number }
  | { type: "restoreHoles"; holes: HoleState[] };

function withHole(state: State, fn: (h: HoleState) => HoleState): State {
  const holes = state.holes.slice();
  holes[state.current] = fn(holes[state.current]);
  return { ...state, holes };
}

function reducer(state: State, action: Action): State {
  const hole = state.holes[state.current];

  switch (action.type) {
    case "setPar":
      return withHole(state, (h) => ({ ...h, par: action.par }));

    case "setLength": {
      const len = Number(state.draft.distance);
      if (!len || Number.isNaN(len)) return state;
      return {
        ...withHole(state, (h) => ({ ...h, length: len })),
        draft: EMPTY_DRAFT,
      };
    }

    case "pickLie":
      return {
        ...state,
        draft: { ...state.draft, endLie: action.lie, distance: "" },
      };

    case "digit": {
      const cur = state.draft.distance;
      if (cur.length >= 3) return state;
      const next = cur === "0" ? action.d : cur + action.d;
      return { ...state, draft: { ...state.draft, distance: next } };
    }

    case "backspace":
      return {
        ...state,
        draft: { ...state.draft, distance: state.draft.distance.slice(0, -1) },
      };

    case "setPenalty":
      return {
        ...state,
        draft: {
          ...state.draft,
          penalty: state.draft.penalty === action.value ? 0 : action.value,
        },
      };

    case "addShot": {
      const start =
        state.draft.editing != null
          ? startForIndex(hole, state.draft.editing)
          : nextStart(hole);
      if (!start) return state;
      const endLie = start.lie === "green" ? "green" : state.draft.endLie;
      const dist = Number(state.draft.distance);
      if (!endLie || !state.draft.distance || Number.isNaN(dist)) return state;
      const shot: ShotEnd = {
        endLie,
        endDistance: dist,
        isHoled: false,
        penaltyStrokes: state.draft.penalty,
      };
      return {
        ...withHole(state, (h) => {
          const shots = h.shots.slice();
          if (state.draft.editing != null) shots[state.draft.editing] = shot;
          else shots.push(shot);
          return { ...h, shots };
        }),
        draft: EMPTY_DRAFT,
      };
    }

    case "holeOut": {
      const start =
        state.draft.editing != null
          ? startForIndex(hole, state.draft.editing)
          : nextStart(hole);
      if (!start) return state;
      const shot: ShotEnd = {
        endLie: null,
        endDistance: null,
        isHoled: true,
        penaltyStrokes: state.draft.penalty,
      };
      return {
        ...withHole(state, (h) => {
          const shots = h.shots.slice();
          if (state.draft.editing != null) shots.splice(state.draft.editing);
          shots.push(shot);
          return { ...h, shots };
        }),
        draft: EMPTY_DRAFT,
      };
    }

    case "undo": {
      if (hole.shots.length > 0) {
        return {
          ...withHole(state, (h) => ({ ...h, shots: h.shots.slice(0, -1) })),
          draft: EMPTY_DRAFT,
        };
      }
      if (hole.length != null) {
        return {
          ...withHole(state, (h) => ({ ...h, length: null })),
          draft: EMPTY_DRAFT,
        };
      }
      return state;
    }

    case "editShot": {
      const s = hole.shots[action.index];
      if (!s || s.isHoled) return state;
      return {
        ...state,
        draft: {
          endLie: s.endLie,
          distance: s.endDistance != null ? String(s.endDistance) : "",
          penalty: s.penaltyStrokes,
          editing: action.index,
        },
      };
    }

    case "deleteShot": {
      const idx = action.index;
      return {
        ...withHole(state, (h) => ({
          ...h,
          shots: h.shots.filter((_, i) => i !== idx),
        })),
        draft: EMPTY_DRAFT,
      };
    }

    case "nextHole": {
      if (!isHoleComplete(hole)) return state;
      const nextIndex = state.current + 1;
      if (nextIndex >= action.numHoles) return state;
      const holes = state.holes.slice();
      if (!holes[nextIndex]) holes[nextIndex] = makeHole(nextIndex + 1);
      return { holes, current: nextIndex, draft: EMPTY_DRAFT };
    }

    case "goToHole": {
      // Only lets you jump to a hole already reached — reaching a new hole
      // still requires completing the current one via "Next hole".
      if (action.index < 0 || action.index >= state.holes.length) return state;
      return { ...state, current: action.index, draft: EMPTY_DRAFT };
    }

    case "restoreHoles":
      return {
        holes: action.holes,
        current: firstIncomplete(action.holes),
        draft: EMPTY_DRAFT,
      };

    default:
      return state;
  }
}

function firstIncomplete(holes: HoleState[]): number {
  const i = holes.findIndex((h) => !isHoleComplete(h));
  return i === -1 ? holes.length - 1 : i;
}

const fmtSg = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

export function RoundSession({
  roundId,
  numHoles,
  handicap,
  initialHoles,
}: {
  roundId: string;
  numHoles: number;
  handicap: number | null;
  initialHoles: HoleState[];
}) {
  const holes0 = initialHoles.length > 0 ? initialHoles : [makeHole(1)];
  const [state, dispatch] = useReducer(reducer, {
    holes: holes0,
    current: firstIncomplete(holes0),
    draft: EMPTY_DRAFT,
  });
  const [finishing, setFinishing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "offline">(
    "synced",
  );
  const [offlineFinishQueued, setOfflineFinishQueued] = useState(false);

  const baseline: Baseline = handicap ?? "tour";
  const hole = state.holes[state.current];
  const start =
    state.draft.editing != null
      ? startForIndex(hole, state.draft.editing)
      : nextStart(hole);
  const complete = isHoleComplete(hole);
  const isLastHole = hole.holeNumber >= numHoles;

  const inputs = useMemo(() => holeShotInputs(hole), [hole]);
  const results = useMemo(
    () => inputs.map((si) => strokesGainedForShot(si, hole.par)),
    [inputs, hole.par],
  );
  const holeSg = useMemo(
    () => holeStrokesGained(inputs, hole.par),
    [inputs, hole.par],
  );
  const round = useMemo(
    () =>
      roundStrokesGained(
        state.holes.map((h) => ({ par: h.par, shots: holeShotInputs(h) })),
        baseline,
      ),
    [state.holes, baseline],
  );

  // Local-first save: try Supabase, and if that fails (offline or a
  // transient error) queue the state in IndexedDB instead of losing it.
  async function attemptSave(holes: HoleState[]): Promise<boolean> {
    try {
      await saveRound(roundId, holes);
      await clearDraft(roundId);
      setSyncStatus("synced");
      return true;
    } catch {
      await putDraft(roundId, holes, false);
      setSyncStatus("offline");
      return false;
    }
  }

  // Same idea for Finish — a queued Finish is retried (from a live, mounted
  // session) until it actually reaches the server, at which point its
  // redirect to the summary fires normally.
  async function attemptFinish(holes: HoleState[]): Promise<boolean> {
    await putDraft(roundId, holes, true);
    setOfflineFinishQueued(true);
    try {
      await finishRound(roundId, holes);
      await clearDraft(roundId);
      setOfflineFinishQueued(false);
      setSyncStatus("synced");
      return true;
    } catch (err) {
      if (isRedirectError(err)) {
        // finishRound succeeded — Next just encodes that as a thrown redirect
        // rather than a normal return, so the two lines above never ran.
        await clearDraft(roundId);
        setOfflineFinishQueued(false);
        setSyncStatus("synced");
        return true;
      }
      setSyncStatus("offline");
      return false;
    }
  }

  // On mount, a leftover local draft (from a sync that never succeeded, e.g.
  // the page reloaded while offline) takes priority over the server's copy —
  // it's strictly newer, since it only exists because a push already failed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await getDraft(roundId);
      if (cancelled || !draft) return;
      dispatch({ type: "restoreHoles", holes: draft.holes });
      setSyncStatus("saving");
      if (draft.wantsFinish) await attemptFinish(draft.holes);
      else await attemptSave(draft.holes);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per mounted session (roundId is stable for its lifetime).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave of the in-progress round.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const holesSnapshot = state.holes;
    const t = setTimeout(() => {
      setSyncStatus("saving");
      void attemptSave(holesSnapshot);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.holes, roundId]);

  // Retry whatever's queued the moment connectivity returns.
  useEffect(() => {
    async function retry() {
      const draft = await getDraft(roundId);
      if (!draft) return;
      setSyncStatus("saving");
      if (draft.wantsFinish) await attemptFinish(draft.holes);
      else await attemptSave(draft.holes);
    }
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  const canGoBack = state.current > 0;
  const canGoForward = state.current < state.holes.length - 1;

  const putting = start?.lie === "green";
  const entryUnit = putting ? "ft" : unitFor(state.draft.endLie ?? "fairway");
  const canAdd =
    !!start && (putting || !!state.draft.endLie) && state.draft.distance !== "";

  async function onFinish() {
    setFinishing(true);
    const ok = await attemptFinish(state.holes);
    if (!ok) setFinishing(false);
    // On success the redirect is already underway; leave `finishing` true
    // until the component unmounts.
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <GuardedLink
          href="/feed"
          aria-label="Exit round"
          className="p-2 text-muted"
        >
          <X size={24} />
        </GuardedLink>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous hole"
            disabled={!canGoBack}
            onClick={() =>
              dispatch({ type: "goToHole", index: state.current - 1 })
            }
            className="p-1 text-muted disabled:opacity-25"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold">
              Hole {hole.holeNumber} of {numHoles}
            </div>
            <div className="text-xs text-muted">
              {syncStatus === "offline" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-negative">
                  <WifiOff size={12} /> Offline — saved locally
                </span>
              ) : syncStatus === "saving" ? (
                "Saving…"
              ) : (
                `Round SG ${fmtSg(round.total)} · ${round.score} strokes`
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Next hole"
            disabled={!canGoForward}
            onClick={() =>
              dispatch({ type: "goToHole", index: state.current + 1 })
            }
            className="p-1 text-muted disabled:opacity-25"
          >
            <ChevronRight size={22} />
          </button>
        </div>
        <button
          type="button"
          onClick={onFinish}
          disabled={finishing}
          className="p-2 text-sm font-semibold text-primary disabled:opacity-40"
        >
          Finish
        </button>
      </header>

      {/* Par selector */}
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-sm font-medium text-muted">Par</span>
        {[3, 4, 5].map((p) => (
          <button
            key={p}
            type="button"
            aria-label={`Par ${p}`}
            aria-pressed={hole.par === p}
            onClick={() => dispatch({ type: "setPar", par: p })}
            className={cn(
              "flex h-11 flex-1 items-center justify-center rounded-app text-lg font-bold",
              hole.par === p
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-foreground",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Shot list */}
      <div className="flex-1 overflow-y-auto px-4">
        {inputs.length === 0 && hole.length != null && (
          <p className="py-6 text-center text-sm text-muted">
            Tee shot from {hole.length} yd — where did it end up?
          </p>
        )}
        <ul className="flex flex-col gap-2 py-2">
          {inputs.map((si, i) => {
            const editable = !state.holes[state.current].shots[i]?.isHoled;
            const sg = results[i].sg;
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => dispatch({ type: "editShot", index: i })}
                  className={cn(
                    "flex w-full items-center justify-between rounded-app border border-border px-3 py-2 text-left",
                    state.draft.editing === i && "border-primary",
                    editable ? "active:bg-surface" : "opacity-90",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-sm font-bold text-muted">
                      {i + 1}
                    </span>
                    <span className="text-sm">
                      {LIE_LABEL[si.startLie]} {si.startDistance}
                      {unitFor(si.startLie)}
                      <span className="mx-1 text-muted">→</span>
                      {si.isHoled ? (
                        <span className="font-semibold text-primary">
                          Holed
                        </span>
                      ) : (
                        <>
                          {LIE_LABEL[si.endLie as Lie]} {si.endDistance}
                          {unitFor(si.endLie as Lie)}
                        </>
                      )}
                      {si.penaltyStrokes > 0 && (
                        <span className="ml-1 rounded bg-negative/10 px-1 text-xs font-semibold text-negative">
                          {si.penaltyStrokes === 2 ? "OB" : "PEN"}
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      sg >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {fmtSg(sg)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {inputs.length > 0 && (
          <div className="flex justify-between border-t border-border py-2 text-sm font-semibold">
            <span>
              {holeSg.score} strokes ({holeSg.score - hole.par >= 0 ? "+" : ""}
              {holeSg.score - hole.par})
            </span>
            <span
              className={holeSg.total >= 0 ? "text-positive" : "text-negative"}
            >
              Hole SG {fmtSg(holeSg.total)}
            </span>
          </div>
        )}
      </div>

      {/* Entry dock */}
      <div className="shrink-0 border-t border-border bg-background px-4 pb-safe pt-3">
        {hole.length == null ? (
          <LengthEntry
            value={state.draft.distance}
            onDigit={(d) => dispatch({ type: "digit", d })}
            onBackspace={() => dispatch({ type: "backspace" })}
            onSet={() => dispatch({ type: "setLength" })}
          />
        ) : complete && state.draft.editing == null ? (
          <div className="flex flex-col gap-3 pb-3">
            <p className="text-center font-semibold">
              Hole complete — {holeSg.score} strokes, SG {fmtSg(holeSg.total)}
            </p>
            {isLastHole && offlineFinishQueued && (
              <p className="flex items-center justify-center gap-1 text-center text-sm font-medium text-negative">
                <WifiOff size={14} /> Offline — will finish syncing once
                you&rsquo;re back online.
              </p>
            )}
            <div className="flex gap-2">
              <BigButton
                variant="secondary"
                onClick={() => dispatch({ type: "undo" })}
              >
                <Undo2 size={20} /> Undo
              </BigButton>
              {isLastHole ? (
                <BigButton block onClick={onFinish} disabled={finishing}>
                  <Flag size={20} /> {finishing ? "Finishing…" : "Finish round"}
                </BigButton>
              ) : (
                <BigButton
                  block
                  onClick={() => dispatch({ type: "nextHole", numHoles })}
                >
                  Next hole →
                </BigButton>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">
                {state.draft.editing != null ? "Editing shot " : "From "}
                <span className="font-semibold text-foreground">
                  {start &&
                    `${LIE_LABEL[start.lie]} ${start.distance}${unitFor(start.lie)}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => dispatch({ type: "undo" })}
                className="flex items-center gap-1 text-muted"
              >
                <Undo2 size={16} /> Undo
              </button>
            </div>

            {!putting && (
              <div className="grid grid-cols-5 gap-1.5">
                {END_LIES.map((lie) => (
                  <button
                    key={lie}
                    type="button"
                    onClick={() => dispatch({ type: "pickLie", lie })}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center rounded-app text-xs font-semibold",
                      state.draft.endLie === lie
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface text-foreground",
                    )}
                  >
                    {LIE_LABEL[lie]}
                  </button>
                ))}
              </div>
            )}

            {/* Distance + penalty */}
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold tabular-nums">
                {state.draft.distance || "0"}
                <span className="ml-1 text-lg font-medium text-muted">
                  {entryUnit}
                </span>
              </div>
              {!putting && (
                <div className="flex gap-1.5">
                  <PenaltyChip
                    label="Penalty"
                    active={state.draft.penalty === 1}
                    onClick={() => dispatch({ type: "setPenalty", value: 1 })}
                  />
                  <PenaltyChip
                    label="OB"
                    active={state.draft.penalty === 2}
                    onClick={() => dispatch({ type: "setPenalty", value: 2 })}
                  />
                </div>
              )}
            </div>

            <NumericKeypad
              onDigit={(d) => dispatch({ type: "digit", d })}
              onBackspace={() => dispatch({ type: "backspace" })}
            />

            <div className="flex gap-2">
              {state.draft.editing != null ? (
                <BigButton
                  variant="danger"
                  onClick={() =>
                    dispatch({
                      type: "deleteShot",
                      index: state.draft.editing!,
                    })
                  }
                >
                  Delete
                </BigButton>
              ) : (
                <BigButton
                  variant="secondary"
                  onClick={() => dispatch({ type: "holeOut" })}
                >
                  Holed
                </BigButton>
              )}
              <BigButton
                block
                disabled={!canAdd}
                onClick={() => dispatch({ type: "addShot" })}
              >
                {state.draft.editing != null ? "Save shot" : "Add shot"}
              </BigButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LengthEntry({
  value,
  onDigit,
  onBackspace,
  onSet,
}: {
  value: string;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onSet: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 pb-3">
      <p className="text-center text-sm text-muted">
        Tee shot — how long is the hole?
      </p>
      <div className="text-center text-4xl font-bold tabular-nums">
        {value || "0"}
        <span className="ml-1 text-xl font-medium text-muted">yd</span>
      </div>
      <NumericKeypad onDigit={onDigit} onBackspace={onBackspace} />
      <BigButton block disabled={value === ""} onClick={onSet}>
        Set length
      </BigButton>
    </div>
  );
}

function PenaltyChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-2 text-sm font-semibold",
        active
          ? "bg-negative text-white"
          : "bg-surface text-foreground border border-border",
      )}
    >
      {label}
    </button>
  );
}
