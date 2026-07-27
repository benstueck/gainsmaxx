"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInAction, signUpAction, type AuthState } from "@/app/auth/actions";
import { Input } from "@/components/ui/input";
import { BigButton } from "@/components/ui/big-button";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );
  // React clears uncontrolled form fields after any action submits, success
  // or not — controlled so a validation error (e.g. a bad email) doesn't
  // also wipe out what was typed.
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Email</span>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Password</span>
        <Input
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={6}
          required
        />
      </label>

      {state.error && <p className="text-sm text-negative">{state.error}</p>}
      {state.message && <p className="text-sm text-primary">{state.message}</p>}

      <BigButton type="submit" block disabled={pending}>
        {pending ? "…" : mode === "signin" ? "Sign in" : "Create account"}
      </BigButton>

      <p className="text-center text-sm text-muted">
        {mode === "signin" ? (
          <>
            New here?{" "}
            <Link className="font-medium text-primary" href="/signup">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Have an account?{" "}
            <Link className="font-medium text-primary" href="/login">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
