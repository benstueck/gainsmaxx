"use client";

import { useState, useTransition } from "react";
import { createPuttSession } from "@/app/puttmaxx/actions";
import { expectedPutts, validateSessionParams } from "@/lib/putt";
import { Input } from "@/components/ui/input";
import { BigButton } from "@/components/ui/big-button";

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-semibold">
        {label}
        {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
      </span>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Rough Tour make rate at a distance. E ≈ 2 − p for putts this short. */
const makePct = (ft: number) => Math.round((2 - expectedPutts(ft)) * 100);

/** Session setup. Defaults come from the user's last session so their
 *  preferred range isn't retyped every time. */
export function NewSessionForm({
  defaultPuttCount,
  defaultMinDistance,
  defaultMaxDistance,
}: {
  defaultPuttCount: number;
  defaultMinDistance: number;
  defaultMaxDistance: number;
}) {
  const [putts, setPutts] = useState(String(defaultPuttCount));
  const [min, setMin] = useState(String(defaultMinDistance));
  const [max, setMax] = useState(String(defaultMaxDistance));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lo = Number(min);
  const hi = Number(max);
  const rangeIsSane =
    Number.isFinite(lo) && Number.isFinite(hi) && lo > 0 && hi >= lo;

  function onStart() {
    const n = Number(putts);
    const invalid = validateSessionParams(n, lo, hi);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    startTransition(() => {
      void createPuttSession(n, lo, hi);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Field label="Putts" value={putts} onChange={setPutts} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min" hint="ft" value={min} onChange={setMin} />
        <Field label="Max" hint="ft" value={max} onChange={setMax} />
      </div>

      {/* The range is the one setting that changes what the session can tell
          you, so show its consequence rather than leaving it abstract. */}
      {rangeIsSane && (
        <p className="rounded-app bg-surface p-3 text-sm text-muted">
          A Tour pro holes about{" "}
          <span className="font-semibold text-foreground">{makePct(lo)}%</span>{" "}
          from {lo} ft and{" "}
          <span className="font-semibold text-foreground">{makePct(hi)}%</span>{" "}
          from {hi} ft.
          {makePct(lo) > 80 && (
            <>
              {" "}
              Ranges this short are nearly all makes, which leaves too few
              misses to read a tendency from.
            </>
          )}
          {makePct(hi) < 20 && (
            <>
              {" "}
              Past ~15 ft this stops being a make-it drill and becomes lag
              putting.
            </>
          )}
        </p>
      )}

      <p className="text-sm text-muted">
        Each putt gets a random distance, slope and break. Set it up on the
        green, hit it, and tap where it finished.
      </p>

      {error && <p className="text-sm font-medium text-negative">{error}</p>}

      <BigButton block disabled={pending} onClick={onStart}>
        {pending ? "Starting…" : "Start session"}
      </BigButton>
    </div>
  );
}
