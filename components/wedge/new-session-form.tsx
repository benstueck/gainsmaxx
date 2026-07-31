"use client";

import { useState, useTransition } from "react";
import { createWedgeSession } from "@/app/wedgemaxx/actions";
import { validateSessionParams } from "@/lib/wedge";
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

/** Session setup. Defaults come from the user's last session so their
 *  preferred range isn't retyped every time. */
export function NewSessionForm({
  defaultBallCount,
  defaultMinDistance,
  defaultMaxDistance,
}: {
  defaultBallCount: number;
  defaultMinDistance: number;
  defaultMaxDistance: number;
}) {
  const [balls, setBalls] = useState(String(defaultBallCount));
  const [min, setMin] = useState(String(defaultMinDistance));
  const [max, setMax] = useState(String(defaultMaxDistance));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onStart() {
    const b = Number(balls);
    const lo = Number(min);
    const hi = Number(max);
    const invalid = validateSessionParams(b, lo, hi);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    startTransition(() => {
      void createWedgeSession(b, lo, hi);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Field label="Balls" value={balls} onChange={setBalls} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min" hint="yds" value={min} onChange={setMin} />
        <Field label="Max" hint="yds" value={max} onChange={setMax} />
      </div>

      <p className="text-sm text-muted">
        Each ball gets a random target in this range. Enter the carry distance
        you actually hit — 100 points is scratch-level distance control.
      </p>

      {error && <p className="text-sm font-medium text-negative">{error}</p>}

      <BigButton block disabled={pending} onClick={onStart}>
        {pending ? "Starting…" : "Start session"}
      </BigButton>
    </div>
  );
}
