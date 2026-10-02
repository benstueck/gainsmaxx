-- Supabase-specific setup for the Puttmaxx tables: auth.users foreign key,
-- row-level security, and per-user access policies. Mirrors 0004 for the
-- Wedgemaxx tables. Runs after 0006 (putt table creation).
--
-- Drizzle does not model RLS, so this is hand-written and registered in
-- meta/_journal.json alongside the generated migrations.

-- 1) Tie sessions to Supabase auth.users ----------------------------------------
ALTER TABLE "putt_sessions"
  ADD CONSTRAINT "putt_sessions_user_id_users_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;
--> statement-breakpoint

-- 2) Enable RLS -----------------------------------------------------------------
ALTER TABLE "putt_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "putt_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- 3) Policies: a user may only touch their own data -----------------------------
-- putt_sessions: owned directly via user_id.
CREATE POLICY "putt_sessions_all_own" ON "putt_sessions"
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));--> statement-breakpoint

-- putt_attempts: owned transitively through the parent session.
CREATE POLICY "putt_attempts_all_own" ON "putt_attempts"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "putt_sessions" s
    WHERE s.id = putt_attempts.session_id AND s.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "putt_sessions" s
    WHERE s.id = putt_attempts.session_id AND s.user_id = (SELECT auth.uid())
  ));
