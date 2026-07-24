"use client";

import { useActionState } from "react";
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

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Email</span>
        <Input name="email" type="email" autoComplete="email" required />
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
