import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth/auth-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/feed");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <span className="text-6xl">⛳️</span>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Gainsmaxxing</h1>
        <p className="text-muted">Sign in to track your strokes gained.</p>
      </div>
      <AuthForm mode="signin" />
    </main>
  );
}
