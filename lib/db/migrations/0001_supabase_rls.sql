-- Supabase-specific setup: auth.users foreign keys, row-level security,
-- per-user access policies, and automatic profile provisioning on signup.
-- Runs after 0000 (table creation).

-- 1) Tie our tables to Supabase auth.users --------------------------------------
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_users_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "rounds"
  ADD CONSTRAINT "rounds_user_id_users_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;
--> statement-breakpoint

-- 2) Enable RLS on every table --------------------------------------------------
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rounds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "holes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- 3) Policies: a user may only touch their own data -----------------------------
-- profiles: row is the user's own profile (id = auth.uid()).
CREATE POLICY "profiles_select_own" ON "profiles"
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_insert_own" ON "profiles"
  FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles"
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));--> statement-breakpoint

-- rounds: owned directly via user_id.
CREATE POLICY "rounds_all_own" ON "rounds"
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));--> statement-breakpoint

-- holes: owned transitively through the parent round.
CREATE POLICY "holes_all_own" ON "holes"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "rounds" r
    WHERE r.id = holes.round_id AND r.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "rounds" r
    WHERE r.id = holes.round_id AND r.user_id = (SELECT auth.uid())
  ));--> statement-breakpoint

-- shots: owned transitively through hole -> round.
CREATE POLICY "shots_all_own" ON "shots"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "holes" h
    JOIN "rounds" r ON r.id = h.round_id
    WHERE h.id = shots.hole_id AND r.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "holes" h
    JOIN "rounds" r ON r.id = h.round_id
    WHERE h.id = shots.hole_id AND r.user_id = (SELECT auth.uid())
  ));--> statement-breakpoint

-- 4) Auto-create a profile row when a new auth user signs up --------------------
CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO "public"."profiles" (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username');
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";--> statement-breakpoint
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();
