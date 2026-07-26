"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { BigButton } from "@/components/ui/big-button";
import { baselineOptions } from "@/lib/baseline";
import {
  updatePasswordAction,
  updateProfileAction,
  type SettingsState,
} from "@/app/profile/actions";

function FieldStatus({ state }: { state: SettingsState }) {
  if (state.error)
    return <p className="text-sm text-negative">{state.error}</p>;
  if (state.message)
    return <p className="text-sm text-positive">{state.message}</p>;
  return null;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Handicap, default baseline, username, and email — one save button for all four. */
export function ProfileSettingsForm({
  handicap,
  defaultBaseline,
  username,
  email,
}: {
  handicap: number | null;
  defaultBaseline: string;
  username: string | null;
  email: string;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateProfileAction,
    {},
  );
  const options = baselineOptions(handicap);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Handicap index">
        <Input
          name="handicap"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          max="54"
          defaultValue={handicap ?? undefined}
          required
        />
      </Field>

      <Field label="Default strokes-gained baseline">
        <select
          name="baseline"
          defaultValue={defaultBaseline}
          className="h-14 w-full rounded-app border border-border bg-background px-3 text-lg"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Username">
        <Input
          name="username"
          defaultValue={username ?? ""}
          placeholder="Your name"
        />
      </Field>

      <Field label="Email">
        <Input name="email" type="email" defaultValue={email} required />
      </Field>

      <BigButton type="submit" disabled={pending} block>
        {pending ? "Saving…" : "Save changes"}
      </BigButton>
      <FieldStatus state={state} />
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updatePasswordAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="New password">
        <Input
          name="password"
          type="password"
          placeholder="New password"
          minLength={6}
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label="Confirm new password">
        <Input
          name="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          minLength={6}
          autoComplete="new-password"
          required
        />
      </Field>
      <BigButton type="submit" disabled={pending} block>
        {pending ? "Saving…" : "Update password"}
      </BigButton>
      <FieldStatus state={state} />
    </form>
  );
}
