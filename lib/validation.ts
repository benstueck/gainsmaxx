/** Simple, permissive email-format check — not a full RFC 5322 validator,
 *  just enough to catch obvious typos before round-tripping to Supabase. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Postgres unique_violation, thrown by the `postgres` driver with a `.code`. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}
