CREATE TABLE "wedge_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_uuid" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ball_count" integer NOT NULL,
	"min_distance" integer NOT NULL,
	"max_distance" integer NOT NULL,
	"elapsed_seconds" integer DEFAULT 0 NOT NULL,
	"status" "round_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wedge_sessions_user_client_uuid_key" UNIQUE("user_id","client_uuid"),
	CONSTRAINT "wedge_sessions_ball_count_check" CHECK ("wedge_sessions"."ball_count" between 1 and 200),
	CONSTRAINT "wedge_sessions_distance_check" CHECK ("wedge_sessions"."min_distance" > 0 and "wedge_sessions"."min_distance" <= "wedge_sessions"."max_distance"),
	CONSTRAINT "wedge_sessions_elapsed_check" CHECK ("wedge_sessions"."elapsed_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wedge_shots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"shot_number" integer NOT NULL,
	"target_distance" integer NOT NULL,
	"carry_distance" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wedge_shots_session_shot_number_key" UNIQUE("session_id","shot_number"),
	CONSTRAINT "wedge_shots_target_check" CHECK ("wedge_shots"."target_distance" > 0),
	CONSTRAINT "wedge_shots_carry_check" CHECK ("wedge_shots"."carry_distance" is null or "wedge_shots"."carry_distance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "wedge_shots" ADD CONSTRAINT "wedge_shots_session_id_wedge_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."wedge_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wedge_sessions_user_started_idx" ON "wedge_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "wedge_shots_session_idx" ON "wedge_shots" USING btree ("session_id");