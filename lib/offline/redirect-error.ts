/**
 * Next encodes a *successful* `redirect()` as a thrown `NEXT_REDIRECT` digest
 * rather than a normal return — so the lines after a redirecting server action
 * never run, and a `catch` sees success as if it were failure.
 *
 * That subtlety caused a real bug twice: a finish that had actually reached
 * the server left its local draft queued forever, because only the
 * non-throwing branch cleared it. Any `catch` around a redirecting action must
 * check this first and treat it as success.
 *
 * Shared rather than copied — it was already duplicated byte-for-byte between
 * the round and wedge sessions before the putting session needed a third.
 */
export function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
