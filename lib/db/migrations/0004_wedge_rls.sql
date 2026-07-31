-- Supabase-specific setup for the Wedgemaxx tables: auth.users foreign key,
-- row-level security, and per-user access policies. Mirrors 0001 for the
-- round-tracking tables. Runs after 0003 (wedge table creation).
--
-- Drizzle does not model RLS, so this is hand-written and registered in
-- meta/_journal.json alongside the generated migrations.

-- 1) Tie sessions to Supabase auth.users ----------------------------------------
ALTER TABLE "wedge_sessions"
  ADD CONSTRAINT "wedge_sessions_user_id_users_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;
--> statement-breakpoint

-- 2) Enable RLS -----------------------------------------------------------------
ALTER TABLE "wedge_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wedge_shots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- 3) Policies: a user may only touch their own data -----------------------------
-- wedge_sessions: owned directly via user_id.
CREATE POLICY "wedge_sessions_all_own" ON "wedge_sessions"
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));--> statement-breakpoint

-- wedge_shots: owned transitively through the parent session.
CREATE POLICY "wedge_shots_all_own" ON "wedge_shots"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "wedge_sessions" s
    WHERE s.id = wedge_shots.session_id AND s.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "wedge_sessions" s
    WHERE s.id = wedge_shots.session_id AND s.user_id = (SELECT auth.uid())
  ));
