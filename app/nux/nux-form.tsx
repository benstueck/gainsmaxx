"use client";

import { useActionState } from "react";
import { completeOnboardingAction, type NuxState } from "./actions";
import { Input } from "@/components/ui/input";
import { BigButton } from "@/components/ui/big-button";

export function NuxForm() {
  const [state, action, pending] = useActionState<NuxState, FormData>(
    completeOnboardingAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="text-center">
        <span className="text-5xl">⛳️</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome</h1>
        <p className="mt-1 text-muted">
          Set up your profile so we can measure your strokes gained against the
          right baseline.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-semibold">Username</span>
        <Input
          name="username"
          placeholder="e.g. Ben"
          required
          autoFocus
          autoComplete="nickname"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold">Your handicap index</span>
        <Input
          name="handicap"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          max="54"
          placeholder="e.g. 12.4"
          required
        />
        <span className="text-sm text-muted">
          Distances use yards &amp; feet. You can change this later in settings.
        </span>
      </label>

      {state.error && <p className="text-sm text-negative">{state.error}</p>}

      <BigButton type="submit" block disabled={pending}>
        {pending ? "Saving…" : "Start tracking"}
      </BigButton>
    </form>
  );
}
