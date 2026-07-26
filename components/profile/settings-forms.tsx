"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { BigButton } from "@/components/ui/big-button";
import { baselineOptions } from "@/lib/baseline";
import {
  updateDefaultBaselineAction,
  updateEmailAction,
  updateHandicapAction,
  updatePasswordAction,
  updateUsernameAction,
  type SettingsState,
} from "@/app/profile/actions";

function FieldStatus({ state }: { state: SettingsState }) {
  if (state.error)
    return <p className="text-sm text-negative">{state.error}</p>;
  if (state.message)
    return <p className="text-sm text-positive">{state.message}</p>;
  return null;
}

function SettingsField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

export function HandicapForm({ handicap }: { handicap: number | null }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateHandicapAction,
    {},
  );
  return (
    <SettingsField label="Handicap index">
      <form action={action} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            className="min-w-0 flex-1"
            name="handicap"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max="54"
            defaultValue={handicap ?? undefined}
            required
          />
          <BigButton type="submit" disabled={pending} className="px-5">
            Save
          </BigButton>
        </div>
        <FieldStatus state={state} />
      </form>
    </SettingsField>
  );
}

export function DefaultBaselineForm({
  handicap,
  defaultBaseline,
}: {
  handicap: number | null;
  defaultBaseline: string;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateDefaultBaselineAction,
    {},
  );
  const options = baselineOptions(handicap);
  return (
    <SettingsField label="Default strokes-gained baseline">
      <form action={action} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            name="baseline"
            defaultValue={defaultBaseline}
            className="h-14 flex-1 rounded-app border border-border bg-background px-3 text-lg"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <BigButton type="submit" disabled={pending} className="px-5">
            Save
          </BigButton>
        </div>
        <FieldStatus state={state} />
      </form>
    </SettingsField>
  );
}

export function UsernameForm({ username }: { username: string | null }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateUsernameAction,
    {},
  );
  return (
    <SettingsField label="Username">
      <form action={action} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            className="min-w-0 flex-1"
            name="username"
            defaultValue={username ?? ""}
            placeholder="Your name"
          />
          <BigButton type="submit" disabled={pending} className="px-5">
            Save
          </BigButton>
        </div>
        <FieldStatus state={state} />
      </form>
    </SettingsField>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateEmailAction,
    {},
  );
  return (
    <SettingsField label="Email">
      <form action={action} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            className="min-w-0 flex-1"
            name="email"
            type="email"
            defaultValue={email}
            required
          />
          <BigButton type="submit" disabled={pending} className="px-5">
            Save
          </BigButton>
        </div>
        <FieldStatus state={state} />
      </form>
    </SettingsField>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updatePasswordAction,
    {},
  );
  return (
    <SettingsField label="Change password">
      <form action={action} className="flex flex-col gap-2">
        <Input
          name="password"
          type="password"
          placeholder="New password"
          minLength={6}
          autoComplete="new-password"
          required
        />
        <Input
          name="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          minLength={6}
          autoComplete="new-password"
          required
        />
        <BigButton type="submit" disabled={pending} block>
          Update password
        </BigButton>
        <FieldStatus state={state} />
      </form>
    </SettingsField>
  );
}
