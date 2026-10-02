CREATE TYPE "public"."putt_break" AS ENUM('l2r', 'r2l', 'straight');--> statement-breakpoint
CREATE TYPE "public"."putt_elevation" AS ENUM('uphill', 'downhill', 'flat');--> statement-breakpoint
CREATE TYPE "public"."putt_line_error" AS ENUM('left', 'right');--> statement-breakpoint
CREATE TYPE "public"."putt_speed_error" AS ENUM('fast', 'slow');--> statement-breakpoint
CREATE TABLE "putt_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"putt_number" integer NOT NULL,
	"distance" integer NOT NULL,
	"elevation" "putt_elevation" NOT NULL,
	"break_direction" "putt_break" NOT NULL,
	"made" boolean NOT NULL,
	"speed_error" "putt_speed_error",
	"line_error" "putt_line_error",
	"misread_line" boolean DEFAULT false NOT NULL,
	"misread_speed" boolean DEFAULT false NOT NULL,
	"comeback_distance" integer,
	"comeback_made" boolean,
	"comeback_speed_error" "putt_speed_error",
	"comeback_line_error" "putt_line_error",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "putt_attempts_session_putt_number_key" UNIQUE("session_id","putt_number"),
	CONSTRAINT "putt_attempts_distance_check" CHECK ("putt_attempts"."distance" > 0),
	CONSTRAINT "putt_attempts_comeback_distance_check" CHECK ("putt_attempts"."comeback_distance" is null or "putt_attempts"."comeback_distance" >= 0),
	CONSTRAINT "putt_attempts_made_consistency_check" CHECK (("putt_attempts"."made" and "putt_attempts"."speed_error" is null and "putt_attempts"."line_error" is null)
          or (not "putt_attempts"."made" and ("putt_attempts"."speed_error" is not null or "putt_attempts"."line_error" is not null))),
	CONSTRAINT "putt_attempts_comeback_presence_check" CHECK (("putt_attempts"."made" and "putt_attempts"."comeback_distance" is null and "putt_attempts"."comeback_made" is null)
          or (not "putt_attempts"."made"))
);
--> statement-breakpoint
CREATE TABLE "putt_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_uuid" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"putt_count" integer NOT NULL,
	"min_distance" integer NOT NULL,
	"max_distance" integer NOT NULL,
	"elapsed_seconds" integer DEFAULT 0 NOT NULL,
	"putts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "round_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "putt_sessions_user_client_uuid_key" UNIQUE("user_id","client_uuid"),
	CONSTRAINT "putt_sessions_count_check" CHECK ("putt_sessions"."putt_count" between 1 and 100),
	CONSTRAINT "putt_sessions_distance_check" CHECK ("putt_sessions"."min_distance" > 0 and "putt_sessions"."min_distance" <= "putt_sessions"."max_distance"),
	CONSTRAINT "putt_sessions_elapsed_check" CHECK ("putt_sessions"."elapsed_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "putt_attempts" ADD CONSTRAINT "putt_attempts_session_id_putt_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."putt_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "putt_attempts_session_idx" ON "putt_attempts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "putt_sessions_user_started_idx" ON "putt_sessions" USING btree ("user_id","started_at");