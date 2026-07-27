/** Simple, permissive email-format check — not a full RFC 5322 validator,
 *  just enough to catch obvious typos before round-tripping to Supabase. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function pgErrorCode(err: unknown): unknown {
  if (typeof err !== "object" || err === null) return undefined;
  if ("code" in err) return (err as { code?: unknown }).code;
  // Drizzle wraps the underlying `postgres` driver error in a
  // DrizzleQueryError, with the real error (and its .code) at .cause.
  if ("cause" in err) return pgErrorCode((err as { cause?: unknown }).cause);
  return undefined;
}

/** Postgres unique_violation (23505), whether thrown directly by the
 *  `postgres` driver or wrapped in Drizzle's DrizzleQueryError. */
export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23505";
}
