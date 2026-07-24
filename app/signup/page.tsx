import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth/auth-form";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/feed");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <span className="text-6xl">⛳️</span>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Create your account
        </h1>
        <p className="text-muted">Start tracking strokes gained in minutes.</p>
      </div>
      <AuthForm mode="signup" />
    </main>
  );
}
