import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Reads/writes the auth session from cookies. Cookie writes are a no-op inside
 * Server Components (they can't set headers) — the middleware refreshes tokens.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — ignore; middleware handles refresh.
          }
        },
      },
    },
  );
}

/**
 * Convenience: the currently authenticated user, or null.
 *
 * Uses getSession() (a local cookie decode, no network call) rather than
 * getUser() (which re-verifies the JWT against Supabase's Auth server).
 * This is safe here specifically because proxy.ts's middleware — which
 * matches every route this app serves except static assets — already
 * calls getUser() and refreshes the cookies earlier in this exact same
 * request, so the session in the cookie jar by the time this runs has
 * already been network-verified moments ago. Don't reuse this pattern
 * somewhere that isn't guaranteed to run after that middleware.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}
